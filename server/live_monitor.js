import { spawn } from 'child_process';
import { storage } from './storage.js';

// Monitor transcription 13 specifically
const TRANSCRIPTION_ID = 13;
const ASSEMBLYAI_ID = '74b89908-2d4e-46fc-9835-9c1a5bb509ff';

console.log(`[LIVE-MONITOR] Starting live monitoring for transcription ${TRANSCRIPTION_ID}`);

const checkInterval = setInterval(async () => {
  try {
    // Check AssemblyAI status
    const pythonProcess = spawn('python3', ['-c', `
import assemblyai as aai
import json

aai.settings.api_key = '0f0da6a87ee34439b8188dc991414cca'

try:
    transcript = aai.Transcript.get_by_id('${ASSEMBLYAI_ID}')
    
    if transcript.status == 'completed':
        # Process speakers and segments
        speakers = []
        segments = []
        
        if hasattr(transcript, 'utterances') and transcript.utterances:
            speaker_map = {}
            speaker_count = 0
            
            for utterance in transcript.utterances:
                speaker_key = utterance.speaker
                if speaker_key not in speaker_map:
                    speaker_id = f'speaker_{speaker_key}'
                    speaker_map[speaker_key] = {
                        'id': speaker_id,
                        'label': f'說話者 {chr(65 + speaker_count)}',
                        'color': f'hsl({(speaker_count * 60) % 360}, 70%, 50%)'
                    }
                    speakers.append(speaker_map[speaker_key])
                    speaker_count += 1
                
                segments.append({
                    'text': utterance.text,
                    'speaker': speaker_map[speaker_key]['id'],
                    'start': utterance.start,
                    'end': utterance.end,
                    'confidence': round(utterance.confidence, 3) if utterance.confidence else 0.9,
                    'timestamp': f'{utterance.start//60000:02d}:{(utterance.start//1000)%60:02d}'
                })
        else:
            speakers = [{
                'id': 'speaker_A',
                'label': '說話者 A',
                'color': 'hsl(200, 70%, 50%)'
            }]
            segments = [{
                'text': transcript.text,
                'speaker': 'speaker_A',
                'start': 0,
                'end': transcript.audio_duration or 0,
                'confidence': round(transcript.confidence, 3) if transcript.confidence else 0.9,
                'timestamp': '00:00'
            }]
        
        result = {
            'status': 'completed',
            'assemblyai_id': transcript.id,
            'transcript_text': transcript.text,
            'speakers': speakers,
            'segments': segments,
            'confidence': round(transcript.confidence, 3) if transcript.confidence else 0.9,
            'duration': transcript.audio_duration,
            'word_count': len(transcript.text.split()) if transcript.text else 0
        }
        
        print('COMPLETED:' + json.dumps(result, ensure_ascii=False))
        
    elif transcript.status == 'error':
        print('ERROR:' + str(transcript.error))
        
    else:
        print('PROCESSING:' + str(transcript.status))
        
except Exception as e:
    print('EXCEPTION:' + str(e))
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.on('close', async (code) => {
      if (output.startsWith('COMPLETED:')) {
        const resultJson = output.substring(10);
        try {
          const result = JSON.parse(resultJson);
          
          // Update database with completed results
          await storage.updateTranscription(TRANSCRIPTION_ID, {
            status: 'completed',
            progress: 100,
            assemblyaiId: result.assemblyai_id,
            transcriptText: result.transcript_text,
            speakers: result.speakers,
            segments: result.segments,
            confidence: result.confidence,
            duration: result.duration,
            wordCount: result.word_count
          });
          
          console.log(`[LIVE-MONITOR] ✓ Transcription ${TRANSCRIPTION_ID} completed and updated!`);
          console.log(`[LIVE-MONITOR] Text: ${result.transcript_text.length} chars, ${result.speakers.length} speakers, ${result.segments.length} segments`);
          
          // Stop monitoring
          clearInterval(checkInterval);
          
        } catch (error) {
          console.error(`[LIVE-MONITOR] Failed to parse result:`, error);
        }
      } else if (output.startsWith('ERROR:')) {
        const errorMessage = output.substring(6);
        await storage.updateTranscription(TRANSCRIPTION_ID, {
          status: 'error',
          errorMessage: errorMessage
        });
        
        console.log(`[LIVE-MONITOR] ✗ Transcription ${TRANSCRIPTION_ID} failed: ${errorMessage}`);
        clearInterval(checkInterval);
        
      } else if (output.startsWith('PROCESSING:')) {
        console.log(`[LIVE-MONITOR] Transcription ${TRANSCRIPTION_ID} still processing...`);
      }
    });
    
  } catch (error) {
    console.error(`[LIVE-MONITOR] Error checking transcription:`, error);
  }
}, 15000); // Check every 15 seconds

// Auto cleanup after 1 hour
setTimeout(() => {
  clearInterval(checkInterval);
  console.log(`[LIVE-MONITOR] Auto-cleanup after 1 hour`);
}, 60 * 60 * 1000);

console.log(`[LIVE-MONITOR] Monitoring active, checking every 15 seconds...`);