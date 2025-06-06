import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Mail, Loader2 } from 'lucide-react';

export default function ForgotPasswordDialog() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: '錯誤',
        description: '請輸入您的郵箱地址',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '請求失敗');
      }

      toast({
        title: '重置成功',
        description: '新密碼已發送到您的郵箱，請查收並使用新密碼登入',
      });
      
      setEmail('');
      setIsOpen(false);
    } catch (error) {
      toast({
        title: '重置失敗',
        description: error instanceof Error ? error.message : '密碼重置失敗，請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="link" 
          className="text-sm text-blue-600 hover:text-blue-800 p-0 h-auto"
        >
          忘記密碼？
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            忘記密碼
          </DialogTitle>
          <DialogDescription>
            請輸入您註冊時使用的郵箱地址，我們將發送新的隨機密碼到您的郵箱。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">郵箱地址</Label>
            <Input
              id="email"
              type="email"
              placeholder="請輸入您的郵箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  發送中...
                </>
              ) : (
                '發送新密碼'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}