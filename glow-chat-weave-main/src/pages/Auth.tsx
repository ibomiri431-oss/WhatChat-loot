import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Geçerli bir email adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır').max(30, 'Kullanıcı adı en fazla 30 karakter olabilir'),
  nickname: z.string().min(1, 'Takma ad gereklidir'),
});

const signInSchema = z.object({
  email: z.string().email('Geçerli bir email adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
});

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const validated = signUpSchema.parse({ email, password, username, nickname });
        const { error } = await signUp(validated.email, validated.password, validated.username, validated.nickname);
        
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Bu email adresi zaten kayıtlı');
          } else if (error.message.includes('unique')) {
            toast.error('Bu kullanıcı adı zaten alınmış — başka deneyin');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Hesap oluşturuldu! Giriş yapılıyor...');
        }
      } else {
        const validated = signInSchema.parse({ email, password });
        const { error } = await signIn(validated.email, validated.password);
        
        if (error) {
          toast.error('Email veya şifre hatalı');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">
            {isSignUp ? 'Hesap Oluştur' : 'Giriş Yap'}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Yeni bir hesap oluşturun ve sohbete başlayın' 
              : 'Hesabınıza giriş yapın'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Kullanıcı Adı</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="kullaniciadi (3-30 karakter)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname">Takma Ad (Görünür İsim)</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Görünür adınız"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    className="bg-secondary/50"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary/50"
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Güçlü bir şifre kullanmanızı öneririz
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Yükleniyor...' : (isSignUp ? 'Hesap Oluştur' : 'Giriş Yap')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setEmail('');
                setPassword('');
                setUsername('');
                setNickname('');
              }}
            >
              {isSignUp 
                ? 'Zaten hesabınız var mı? Giriş yapın' 
                : 'Hesabınız yok mu? Kayıt olun'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
