import { google, calendar_v3 } from 'googleapis';
import crypto from 'crypto';
import { db } from './db';
import { userGoogleCalendar, CalendarEvent } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Environment variables for Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/auth/callback';
const GOOGLE_TOKEN_ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';

// Google Calendar scopes (read-only) + email for identification
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Create OAuth2 client
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// ==================== Token Encryption/Decryption ====================

/**
 * Encrypt token using AES-256-GCM
 */
function encryptToken(token: string, iv: Buffer): string {
  if (!GOOGLE_TOKEN_ENCRYPTION_KEY || GOOGLE_TOKEN_ENCRYPTION_KEY.length !== 64) {
    throw new Error('Invalid GOOGLE_TOKEN_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)');
  }

  const key = Buffer.from(GOOGLE_TOKEN_ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: encrypted:authTag
  return `${encrypted}:${authTag}`;
}

/**
 * Decrypt token using AES-256-GCM
 */
function decryptToken(encryptedData: string, ivHex: string): string {
  if (!GOOGLE_TOKEN_ENCRYPTION_KEY || GOOGLE_TOKEN_ENCRYPTION_KEY.length !== 64) {
    throw new Error('Invalid GOOGLE_TOKEN_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)');
  }

  const key = Buffer.from(GOOGLE_TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  const [encrypted, authTag] = encryptedData.split(':');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Buffer {
  return crypto.randomBytes(16);
}

// ==================== OAuth Functions ====================

/**
 * Generate OAuth authorization URL with state parameter
 */
export function generateAuthUrl(userId: number): string {
  const oauth2Client = createOAuth2Client();

  // Create state parameter for CSRF protection
  const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return url;
}

/**
 * Parse and validate state parameter
 */
export function parseState(state: string): { userId: number; timestamp: number } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));

    // Validate timestamp (state should be valid for 10 minutes)
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - decoded.timestamp > tenMinutes) {
      console.error('[GoogleCalendar] State expired');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[GoogleCalendar] Failed to parse state:', error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens and save to database
 */
export async function handleOAuthCallback(
  code: string,
  userId: number
): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return { success: false, error: 'Failed to obtain tokens' };
    }

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    // Get user's Google email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    if (!googleEmail) {
      return { success: false, error: 'Failed to get Google email' };
    }

    // Encrypt tokens
    const iv = generateIV();
    const ivHex = iv.toString('hex');
    const encryptedAccessToken = encryptToken(tokens.access_token, iv);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token, iv);

    // Calculate token expiry
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

    // Check if user already has a binding
    const existing = await db.select()
      .from(userGoogleCalendar)
      .where(eq(userGoogleCalendar.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing binding
      await db.update(userGoogleCalendar)
        .set({
          googleEmail,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenIv: ivHex,
          tokenExpiresAt: expiresAt,
          scope: SCOPES.join(' '),
          updatedAt: new Date(),
        })
        .where(eq(userGoogleCalendar.userId, userId));
    } else {
      // Create new binding
      await db.insert(userGoogleCalendar).values({
        userId,
        googleEmail,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenIv: ivHex,
        tokenExpiresAt: expiresAt,
        scope: SCOPES.join(' '),
      });
    }

    console.log(`[GoogleCalendar] Successfully linked Google account for user ${userId}: ${googleEmail}`);
    return { success: true, email: googleEmail };

  } catch (error) {
    console.error('[GoogleCalendar] OAuth callback error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get authenticated OAuth client for a user (with automatic token refresh)
 */
async function getAuthenticatedClient(userId: number): Promise<ReturnType<typeof createOAuth2Client> | null> {
  try {
    const records = await db.select()
      .from(userGoogleCalendar)
      .where(eq(userGoogleCalendar.userId, userId))
      .limit(1);

    if (records.length === 0) {
      return null;
    }

    const record = records[0];

    // Decrypt tokens
    const accessToken = decryptToken(record.accessToken, record.tokenIv);
    const refreshToken = decryptToken(record.refreshToken, record.tokenIv);

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: record.tokenExpiresAt.getTime(),
    });

    // Check if token is expired and refresh if needed
    if (record.tokenExpiresAt.getTime() < Date.now()) {
      console.log(`[GoogleCalendar] Token expired for user ${userId}, refreshing...`);

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();

        if (credentials.access_token) {
          // Re-encrypt and save new access token
          const iv = generateIV();
          const ivHex = iv.toString('hex');
          const encryptedAccessToken = encryptToken(credentials.access_token, iv);
          const encryptedRefreshToken = credentials.refresh_token
            ? encryptToken(credentials.refresh_token, iv)
            : encryptToken(refreshToken, iv);

          await db.update(userGoogleCalendar)
            .set({
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenIv: ivHex,
              tokenExpiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
              updatedAt: new Date(),
            })
            .where(eq(userGoogleCalendar.userId, userId));

          oauth2Client.setCredentials(credentials);
        }
      } catch (refreshError) {
        console.error('[GoogleCalendar] Token refresh failed:', refreshError);
        // Token refresh failed, user needs to re-authorize
        await db.delete(userGoogleCalendar).where(eq(userGoogleCalendar.userId, userId));
        return null;
      }
    }

    return oauth2Client;

  } catch (error) {
    console.error('[GoogleCalendar] Failed to get authenticated client:', error);
    return null;
  }
}

// ==================== Calendar Functions ====================

/**
 * Get calendar events within a time range
 */
export async function getCalendarEvents(
  userId: number,
  timeMin: Date,
  timeMax: Date,
  maxResults: number = 50
): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
  try {
    const oauth2Client = await getAuthenticatedClient(userId);

    if (!oauth2Client) {
      return { success: false, error: 'Google Calendar not linked' };
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = (response.data.items || []).map((event: calendar_v3.Schema$Event) => ({
      id: event.id || '',
      summary: event.summary || '(No title)',
      description: event.description || undefined,
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
        timeZone: event.start?.timeZone || undefined,
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
        timeZone: event.end?.timeZone || undefined,
      },
      organizer: event.organizer ? {
        email: event.organizer.email || undefined,
        displayName: event.organizer.displayName || undefined,
      } : undefined,
      attendees: event.attendees?.map(a => ({
        email: a.email || undefined,
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      location: event.location || undefined,
      status: event.status || undefined,
      htmlLink: event.htmlLink || undefined,
    }));

    return { success: true, events };

  } catch (error) {
    console.error('[GoogleCalendar] Failed to get events:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch events' };
  }
}

/**
 * Check if user has linked Google Calendar
 */
export async function getCalendarStatus(userId: number): Promise<{
  linked: boolean;
  email?: string;
}> {
  try {
    const records = await db.select()
      .from(userGoogleCalendar)
      .where(eq(userGoogleCalendar.userId, userId))
      .limit(1);

    if (records.length === 0) {
      return { linked: false };
    }

    return {
      linked: true,
      email: records[0].googleEmail,
    };

  } catch (error) {
    console.error('[GoogleCalendar] Failed to get status:', error);
    return { linked: false };
  }
}

/**
 * Unlink Google Calendar from user account
 */
export async function unlinkCalendar(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Optionally revoke the token first
    const oauth2Client = await getAuthenticatedClient(userId);
    if (oauth2Client) {
      try {
        const credentials = oauth2Client.credentials;
        if (credentials.access_token) {
          await oauth2Client.revokeToken(credentials.access_token);
        }
      } catch (revokeError) {
        // Ignore revoke errors, continue with deletion
        console.warn('[GoogleCalendar] Token revoke failed:', revokeError);
      }
    }

    // Delete the record
    await db.delete(userGoogleCalendar).where(eq(userGoogleCalendar.userId, userId));

    console.log(`[GoogleCalendar] Unlinked Google Calendar for user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error('[GoogleCalendar] Failed to unlink:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to unlink' };
  }
}

/**
 * Check if Google Calendar integration is properly configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_TOKEN_ENCRYPTION_KEY);
}
