import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Star } from "lucide-react";
import type { UserKeyword } from "@shared/schema";

interface KeywordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function KeywordInput({ value, onChange, placeholder = "輸入關鍵字（以逗號分隔）" }: KeywordInputProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved keyword sets
  const { data: keywordSets = [] } = useQuery<UserKeyword[]>({
    queryKey: ["/api/keywords"],
  });

  // Create new keyword set
  const createKeywordMutation = useMutation({
    mutationFn: async (data: { name: string; keywords: string }) => {
      return apiRequest("/api/keywords", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setIsDialogOpen(false);
      setNewSetName("");
      toast({
        title: "關鍵字組合已儲存",
        description: "您的關鍵字組合已成功儲存，下次可以直接選用。",
      });
    },
    onError: () => {
      toast({
        title: "儲存失敗",
        description: "無法儲存關鍵字組合，請稍後再試。",
        variant: "destructive",
      });
    },
  });

  // Use keyword set
  const useKeywordMutation = useMutation({
    mutationFn: async (keywordId: number) => {
      return apiRequest(`/api/keywords/${keywordId}/use`, {
        method: "PATCH",
      });
    },
  });

  // Delete keyword set
  const deleteKeywordMutation = useMutation({
    mutationFn: async (keywordId: number) => {
      return apiRequest(`/api/keywords/${keywordId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({
        title: "關鍵字組合已刪除",
        description: "選定的關鍵字組合已成功刪除。",
      });
    },
  });

  const handleSaveKeywords = () => {
    if (!newSetName.trim() || !value.trim()) {
      toast({
        title: "請填寫完整資訊",
        description: "請輸入組合名稱和關鍵字。",
        variant: "destructive",
      });
      return;
    }

    createKeywordMutation.mutate({
      name: newSetName.trim(),
      keywords: value.trim(),
    });
  };

  const handleUseKeywordSet = (keywordSet: UserKeyword) => {
    onChange(keywordSet.keywords);
    useKeywordMutation.mutate(keywordSet.id);
    toast({
      title: "關鍵字已套用",
      description: `已套用「${keywordSet.name}」的關鍵字組合。`,
    });
  };

  const handleDeleteKeywordSet = (keywordSet: UserKeyword, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteKeywordMutation.mutate(keywordSet.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <Label htmlFor="keywords" className="text-sm font-medium">
            自訂關鍵字
          </Label>
          <Input
            id="keywords"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="mt-1"
          />
        </div>
        
        {value.trim() && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-6">
                <Save className="w-4 h-4 mr-1" />
                儲存
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>儲存關鍵字組合</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="setName">組合名稱</Label>
                  <Input
                    id="setName"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="例如：會議轉錄、訪談記錄"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>關鍵字預覽</Label>
                  <div className="mt-1 p-2 bg-slate-50 rounded border text-sm">
                    {value}
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleSaveKeywords}
                    disabled={createKeywordMutation.isPending}
                  >
                    {createKeywordMutation.isPending ? "儲存中..." : "儲存"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Saved keyword sets */}
      {keywordSets.length > 0 && (
        <div>
          <Label className="text-sm font-medium text-slate-600">
            已儲存的關鍵字組合
          </Label>
          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
            {keywordSets.map((keywordSet) => (
              <div
                key={keywordSet.id}
                className="flex items-center justify-between p-2 bg-slate-50 rounded border hover:bg-slate-100 cursor-pointer transition-colors"
                onClick={() => handleUseKeywordSet(keywordSet)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm truncate">
                      {keywordSet.name}
                    </span>
                    {keywordSet.usageCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        {keywordSet.usageCount}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-1">
                    {keywordSet.keywords}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDeleteKeywordSet(keywordSet, e)}
                  className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick add common keywords */}
      <div>
        <Label className="text-sm font-medium text-slate-600">
          常用關鍵字
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "會議, 討論, 決策",
            "訪談, 採訪, 對話", 
            "演講, 講座, 分享",
            "教學, 課程, 學習",
            "報告, 簡報, 發表"
          ].map((keywords) => (
            <Badge
              key={keywords}
              variant="outline"
              className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => onChange(keywords)}
            >
              <Plus className="w-3 h-3 mr-1" />
              {keywords.split(',')[0]}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}