import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Edit2, Check, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus, Speaker } from "@/lib/types";

interface SpeakerEditorProps {
  transcription: TranscriptionStatus;
  onSpeakersUpdated: (speakers: Speaker[]) => void;
}

export default function SpeakerEditor({ transcription, onSpeakersUpdated }: SpeakerEditorProps) {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [speakers, setSpeakers] = useState<Speaker[]>(transcription.speakers || []);
  const { toast } = useToast();

  const startEdit = (speaker: Speaker) => {
    setEditingSpeaker(speaker.id);
    setEditingName(speaker.label);
  };

  const cancelEdit = () => {
    setEditingSpeaker(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingSpeaker || !editingName.trim()) return;

    const updatedSpeakers = speakers.map(speaker => 
      speaker.id === editingSpeaker 
        ? { ...speaker, label: editingName.trim() }
        : speaker
    );

    try {
      const response = await fetch(`/api/transcriptions/${transcription.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakers: updatedSpeakers })
      });

      if (!response.ok) throw new Error('更新失敗');

      setSpeakers(updatedSpeakers);
      onSpeakersUpdated(updatedSpeakers);
      setEditingSpeaker(null);
      setEditingName("");
      
      toast({
        title: "對話者名稱已更新",
        description: "對話者標識已成功修改",
      });
    } catch (error) {
      toast({
        title: "更新失敗",
        description: "無法更新對話者名稱",
        variant: "destructive",
      });
    }
  };

  const resetAllSpeakers = async () => {
    const originalSpeakers = speakers.map((speaker, index) => ({
      ...speaker,
      label: `Speaker ${index + 1}`
    }));

    try {
      const response = await fetch(`/api/transcriptions/${transcription.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakers: originalSpeakers })
      });

      if (!response.ok) throw new Error('重設失敗');

      setSpeakers(originalSpeakers);
      onSpeakersUpdated(originalSpeakers);
      
      toast({
        title: "對話者名稱已重設",
        description: "所有對話者標識已恢復為預設名稱",
      });
    } catch (error) {
      toast({
        title: "重設失敗",
        description: "無法重設對話者名稱",
        variant: "destructive",
      });
    }
  };

  if (!speakers || speakers.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">對話者標識管理</CardTitle>
            <Badge variant="secondary">{speakers.length} 位對話者</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetAllSpeakers}
            className="text-xs"
          >
            重設全部
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {speakers.map((speaker) => (
            <div 
              key={speaker.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: speaker.color }}
                />
                {editingSpeaker === speaker.id ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 w-40"
                      placeholder="輸入對話者名稱"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={!editingName.trim()}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-slate-900">
                      {speaker.label}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {speaker.id}
                    </Badge>
                  </>
                )}
              </div>
              {editingSpeaker !== speaker.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(speaker)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>使用說明：</strong>點擊編輯按鈕可修改對話者名稱，例如將「Speaker 1」改為「張經理」或「李同事」等。
            修改後的名稱會立即套用到整個轉錄內容中。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}