import React, { useState, useEffect } from 'react';
import { Employee } from '@/entities/Employee';
import { User } from '@/entities/User';
import { Post } from '@/entities/Post';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gift, RefreshCw, AlertCircle, Mail, Star, Trophy, Sparkles, Users, Heart } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import PostForm from '@/components/recados/PostForm';
import PostCard from '@/components/recados/PostCard';
import { SendEmail } from '@/integrations/Core';

export default function RecognitionsPage() {
  const [user, setUser] = useState(null);
  const [companyAnniversaries, setCompanyAnniversaries] = useState([]);
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [isLoading, setIsLoading] = useState({ posts: false, anniversaries: false });
  const [error, setError] = useState({ posts: null, anniversaries: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (currentUser?.cnpj) {
        await loadPostsAndUsers(currentUser);
        await loadAnniversaries(currentUser);
      }
    } catch (e) {
      console.error("Erro ao carregar usuário:", e);
      setError(prev => ({ ...prev, posts: "Erro ao carregar dados do usuário." }));
    }
  };

  const loadPostsAndUsers = async (currentUser = user) => {
    if (!currentUser?.cnpj) return;
    setIsLoading(prev => ({ ...prev, posts: true }));
    setError(prev => ({ ...prev, posts: null }));
    try {
      let postsData = [];
      try {
        const allPosts = await Post.list("-created_date", 100);
        postsData = allPosts.filter(post =>
          post.cnpj === currentUser.cnpj && !post.deleted_at
        );
      } catch (postError) {
        console.warn("Erro ao carregar posts:", postError);
        postsData = [];
      }
      let usersData = [];
      try {
        usersData = await User.filter({ cnpj: currentUser.cnpj });
      } catch (userError) {
        console.warn("Erro ao carregar usuários:", userError);
        usersData = [currentUser];
      }
      const uMap = usersData.reduce((acc, u) => {
        acc[u.email] = u;
        return acc;
      }, {});
      setUsersMap(uMap);
      setPosts(postsData);
    } catch (err) {
      console.error("Erro geral ao carregar posts:", err);
      setError(prev => ({
        ...prev,
        posts: "Não foi possível carregar o mural. Verifique sua conexão e tente novamente."
      }));
      setPosts([]);
      setUsersMap({ [currentUser.email]: currentUser });
    } finally {
      setIsLoading(prev => ({ ...prev, posts: false }));
    }
  };

  const loadAnniversaries = async (currentUser = user) => {
    if (!currentUser?.cnpj) return;
    setIsLoading(prev => ({ ...prev, anniversaries: true }));
    setError(prev => ({ ...prev, anniversaries: null }));
    try {
      const employeesData = await Employee.filter({ cnpj: currentUser.cnpj, status: 'ativo' });
      const today = new Date();
      const currentMonth = today.getMonth();
      const anniversaries = employeesData.filter(emp => {
        if (!emp.admission_date) return false;
        const admissionDate = new Date(emp.admission_date);
        return admissionDate.getMonth() === currentMonth && differenceInYears(today, admissionDate) >= 1;
      }).map(emp => ({
        ...emp,
        yearsWorking: differenceInYears(today, new Date(emp.admission_date))
      }));
      setCompanyAnniversaries(anniversaries);
    } catch (err) {
      console.error("Erro ao carregar aniversários:", err);
      setError(prev => ({ ...prev, anniversaries: "Não foi possível carregar os aniversários." }));
      setCompanyAnniversaries([]);
    } finally {
      setIsLoading(prev => ({ ...prev, anniversaries: false }));
    }
  };

  const handleSendRecognition = async () => {
    if (!companyAnniversaries || companyAnniversaries.length === 0) {
      alert("Nenhum aniversariante para notificar este mês.");
      return;
    }
    if (!window.confirm(`Você está prestes a notificar ${companyAnniversaries.length} aniversariante(s) por e-mail. Deseja continuar?`)) {
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    for (const emp of companyAnniversaries) {
      if (emp.email) {
        try {
          const subject = `🎉 Reconhecimento de Aniversário de Empresa!`;
          const body = `
            <p>Olá, ${emp.name}!</p>
            <p>A <strong>${user.company_name || 'nossa empresa'}</strong> te parabeniza por completar <strong>${emp.yearsWorking} ano(s)</strong> de dedicação e trabalho conosco!</p>
            <p>Agradecemos por sua contribuição e esperamos celebrar muitos outros aniversários juntos.</p>
            <br>
            <p>Atenciosamente,</p>
            <p><strong>Equipe FaciliGestor360</strong></p>
          `;
          await SendEmail({ to: emp.email, subject, body });
          successCount++;
        } catch (error) {
          console.error(`Falha ao enviar e-mail para ${emp.email}:`, error);
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }
    alert(`${successCount} e-mail(s) de reconhecimento enviado(s) com sucesso. Falhas: ${errorCount}.`);
  };

  const handlePost = async (postData) => {
    try {
      await Post.create({
        ...postData,
        cnpj: user.cnpj,
        created_by: user.email,
        likes: []
      });
      await loadPostsAndUsers();
    } catch (error) {
      console.error("Erro ao criar post:", error);
      alert("Erro ao publicar o recado. Tente novamente.");
    }
  };

  const handleLike = async (post) => {
    try {
      const currentLikes = post.likes || [];
      const userEmail = user.email;
      const hasLiked = currentLikes.includes(userEmail);
      const newLikes = hasLiked
        ? currentLikes.filter(email => email !== userEmail)
        : [...currentLikes, userEmail];
      await Post.update(post.id, { likes: newLikes });
      await loadPostsAndUsers();
    } catch (error) {
      console.error("Erro ao curtir post:", error);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await Post.update(postId, {
        deleted_at: new Date().toISOString(),
        deleted_by: user.email,
      });
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
    } catch (error) {
      console.error("Erro ao excluir post:", error);
      alert("Erro ao excluir o recado. Tente novamente.");
    }
  };

  const getMedalColor = (years) => {
    if (years >= 10) return { bg: 'from-yellow-400 to-amber-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', icon: '🥇' };
    if (years >= 5) return { bg: 'from-slate-300 to-slate-400', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', icon: '🥈' };
    return { bg: 'from-orange-300 to-amber-400', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800', icon: '🥉' };
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-purple-300 border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium animate-pulse">Carregando mural...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/40">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 sm:px-6 lg:px-8 py-10">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-4 right-40 w-32 h-32 bg-pink-300/20 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-purple-200 text-sm font-medium tracking-wider uppercase">Ambiente de Reconhecimento</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
            Mural de Recados
          </h1>
          <p className="text-purple-100 text-base max-w-xl">
            Compartilhe recados com a equipe, celebre conquistas e reconheça aniversários de empresa.
          </p>

          {/* Stats bar */}
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2 text-white/90">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{Object.keys(usersMap).length} membros</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">{posts.length} publicações</span>
            </div>
            {companyAnniversaries.length > 0 && (
              <div className="flex items-center gap-2 text-yellow-300">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-medium">{companyAnniversaries.length} aniversário{companyAnniversaries.length !== 1 ? 's' : ''} este mês</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-5">
            <PostForm user={user} onPost={handlePost} />

            {error.posts ? (
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao Carregar Mural</h3>
                <p className="text-gray-500 mb-5 text-sm">{error.posts}</p>
                <Button
                  onClick={() => loadPostsAndUsers()}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            ) : isLoading.posts ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-3 bg-gray-100 rounded w-24" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-full" />
                      <div className="h-4 bg-gray-100 rounded w-5/6" />
                      <div className="h-4 bg-gray-100 rounded w-4/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {posts.map(post => {
                  const author = usersMap[post.created_by] || {
                    full_name: post.created_by,
                    photo_url: null
                  };
                  return (
                    <PostCard
                      key={post.id}
                      post={post}
                      author={author}
                      currentUser={user}
                      onLike={handleLike}
                      onDelete={handleDelete}
                    />
                  );
                })}
                {posts.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5">
                      <Sparkles className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum recado ainda</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">
                      Seja o primeiro a compartilhar algo especial com a equipe!
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-5">
            {/* Aniversários Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">Aniversários de Empresa</h2>
                    <p className="text-purple-200 text-xs">Conquistas do mês atual</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {isLoading.anniversaries ? (
                  <div className="py-8 space-y-3">
                    {[1, 2].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                        <div className="w-10 h-10 bg-gray-200 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-gray-200 rounded w-28" />
                          <div className="h-3 bg-gray-100 rounded w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error.anniversaries ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{error.anniversaries}</p>
                  </div>
                ) : companyAnniversaries.length > 0 ? (
                  <div className="space-y-3 py-1">
                    {companyAnniversaries.map((emp) => {
                      const medal = getMedalColor(emp.yearsWorking);
                      return (
                        <div
                          key={emp.id}
                          className="group flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 transition-all duration-200 cursor-default"
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar className="w-11 h-11 ring-2 ring-purple-100 group-hover:ring-purple-300 transition-all">
                              <AvatarImage src={emp.photo_url} />
                              <AvatarFallback className={`bg-gradient-to-br ${medal.bg} text-white font-bold text-sm`}>
                                {emp.name?.charAt(0) || 'F'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 text-sm leading-none">
                              {medal.icon}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                            <p className="text-xs text-gray-400 truncate mb-1">{emp.role || 'Colaborador'}</p>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${medal.badge}`}>
                                <Star className="w-3 h-3" />
                                {emp.yearsWorking} ano{emp.yearsWorking !== 1 ? 's' : ''} na empresa
                              </span>
                              {emp.whatsapp && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    let phone = emp.whatsapp.replace(/\D/g, '');
                                    if (phone.length === 10 || phone.length === 11) {
                                      if (!phone.startsWith('55')) {
                                        phone = '55' + phone;
                                      }
                                    }
                                    const message = `Parabéns, ${emp.name}! A ${user?.company_name || 'empresa'} te parabeniza por completar ${emp.yearsWorking} ano(s) de dedicação e trabalho conosco! 🎉👏`;
                                    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                                  title="Enviar parabéns por WhatsApp"
                                >
                                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
                                  </svg>
                                  WhatsApp
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-8 h-8 text-purple-300" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Nenhum aniversário este mês</p>
                    <p className="text-gray-400 text-xs mt-1">Os aniversariantes aparecerão aqui</p>
                  </div>
                )}

                {companyAnniversaries.length > 0 && (
                  <Button
                    onClick={handleSendRecognition}
                    className="w-full mt-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar Reconhecimento
                  </Button>
                )}
              </div>
            </div>

            {/* Dica Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-800 mb-1">Cultura de Reconhecimento</p>
                  <p className="text-xs text-indigo-600 leading-relaxed">
                    Reconhecer e valorizar os colaboradores aumenta o engajamento e a produtividade da equipe.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}