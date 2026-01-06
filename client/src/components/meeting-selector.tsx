import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  AlertCircle,
} from "lucide-react";
import { CalendarEvent } from "@shared/schema";
import { format, startOfDay, endOfDay, subDays, addDays, startOfWeek, endOfWeek, isToday, isSameDay } from "date-fns";
import { zhTW } from "date-fns/locale";

interface MeetingSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMeeting: (meeting: CalendarEvent) => void;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'past7' | 'custom';

export default function MeetingSelector({
  open,
  onOpenChange,
  onSelectMeeting,
}: MeetingSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 7));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  // Calculate date range based on preset
  const { timeMin, timeMax } = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return {
          timeMin: startOfDay(now),
          timeMax: endOfDay(now),
        };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return {
          timeMin: startOfDay(yesterday),
          timeMax: endOfDay(yesterday),
        };
      case 'week':
        return {
          timeMin: startOfWeek(now, { weekStartsOn: 1 }),
          timeMax: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'past7':
        return {
          timeMin: startOfDay(subDays(now, 6)),
          timeMax: endOfDay(now),
        };
      case 'custom':
        return {
          timeMin: startOfDay(customStartDate),
          timeMax: endOfDay(customEndDate),
        };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch calendar events
  const { data, isLoading, error, refetch } = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ['/api/google/calendar/events', timeMin.toISOString(), timeMax.toISOString()],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/google/calendar/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch events');
      }
      return response.json();
    },
    enabled: open,
  });

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    if (!searchQuery.trim()) return data.events;
    const query = searchQuery.toLowerCase();
    return data.events.filter(event =>
      event.summary?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query) ||
      event.location?.toLowerCase().includes(query)
    );
  }, [data?.events, searchQuery]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(event => {
      const dateStr = event.start.dateTime || event.start.date || '';
      const date = new Date(dateStr);
      const key = format(date, 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    // Sort by date descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEvents]);

  const handleSelectMeeting = (event: CalendarEvent) => {
    onSelectMeeting(event);
    onOpenChange(false);
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
      if (end) {
        return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
      }
      return format(start, 'HH:mm');
    }
    return "全天";
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return "今天";
    }
    if (isSameDay(date, subDays(new Date(), 1))) {
      return "昨天";
    }
    return format(date, 'M月d日 EEEE', { locale: zhTW });
  };

  const presetButtons: { value: DatePreset; label: string }[] = [
    { value: 'today', label: '今天' },
    { value: 'yesterday', label: '昨天' },
    { value: 'week', label: '本週' },
    { value: 'past7', label: '過去7天' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>選擇會議</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            選擇一個會議，其名稱將作為轉錄記錄的標題
          </DialogDescription>
        </DialogHeader>

        {/* Date Presets */}
        <div className="p-4 pb-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {presetButtons.map(({ value, label }) => (
              <Button
                key={value}
                variant={datePreset === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDatePreset(value)}
                className="h-8 text-xs"
              >
                {label}
              </Button>
            ))}
            <Button
              variant={datePreset === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('custom')}
              className="h-8 text-xs"
            >
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              自訂
            </Button>
          </div>

          {/* Custom Date Range */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={format(customStartDate, 'yyyy-MM-dd')}
                onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                className="h-8 text-xs"
              />
              <span className="text-muted-foreground text-xs">至</span>
              <Input
                type="date"
                value={format(customEndDate, 'yyyy-MM-dd')}
                onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋會議..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Events List */}
        <ScrollArea className="flex-1 max-h-[350px]">
          <div className="p-4 pt-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">載入行事曆...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mb-3" />
                <p className="text-sm text-destructive mb-2">載入失敗</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : '無法取得行事曆事件'}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  重試
                </Button>
              </div>
            ) : groupedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? '找不到符合的會議' : '此時間範圍內沒有會議'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedEvents.map(([dateStr, events]) => (
                  <div key={dateStr}>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                      {formatDateHeader(dateStr)}
                    </h3>
                    <div className="space-y-2">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleSelectMeeting(event)}
                          className="w-full p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {event.summary || '(無標題)'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatEventTime(event)}
                            </div>
                            {event.location && (
                              <div className="flex items-center truncate">
                                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center mt-2 text-xs text-muted-foreground">
                              <Users className="w-3 h-3 mr-1" />
                              <span>{event.attendees.length} 位參與者</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
