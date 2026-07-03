import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, Trash2, MoreVertical, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import DeleteConfirmation from '@/components/common/DeleteConfirmation';

export default function PostCard({ post, author, currentUser, onLike, onDelete }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const hasLiked = post.likes?.includes(currentUser?.email);
  const likeCount = post.likes?.length || 0;
  const canDelete = post.created_by === currentUser?.email || currentUser?.department === 'admin';

  const handleDeleteConfirm = async () => {
    await onDelete(post.id);
    setIsDeleteDialogOpen(false);
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const prevImage = () => {
    setLightboxIndex(i => (i - 1 + post.photo_urls.length) % post.photo_urls.length);
  };
  const nextImage = () => {
    setLightboxIndex(i => (i + 1) % post.photo_urls.length);
  };

  const renderImages = () => {
    if (!post.photo_urls || post.photo_urls.length === 0) return null;
    const count = post.photo_urls.length;
    const shown = post.photo_urls.slice(0, 4);
    const extra = count > 4 ? count - 4 : 0;

    const gridClass =
      count === 1 ? 'grid-cols-1' :
      count === 2 ? 'grid-cols-2' :
      'grid-cols-2';

    const heightClass =
      count === 1 ? 'h-72 sm:h-96' :
      count === 2 ? 'h-52 sm:h-64' :
      'h-40 sm:h-48';

    return (
      <div className={`grid gap-1.5 mb-4 ${gridClass}`}>
        {shown.map((url, index) => (
          <div
            key={index}
            className="relative group cursor-pointer"
            onClick={() => openLightbox(index)}
          >
            <div className={`${heightClass} rounded-xl overflow-hidden shadow-sm`}>
              <img
                src={url}
                alt={`Anexo ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 flex items-center justify-center rounded-xl">
                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-md">
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </div>
              </div>
              {/* More images overlay */}
              {index === 3 && extra > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                  <span className="text-white text-2xl font-bold">+{extra}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Generate a subtle color based on the author email
  const getAvatarGradient = (email) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-rose-600',
      'from-cyan-500 to-blue-600',
      'from-violet-500 to-purple-600',
    ];
    const idx = (email?.charCodeAt(0) || 0) % colors.length;
    return colors[idx];
  };

  const gradient = getAvatarGradient(author?.email);

  return (
    <>
      <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 overflow-hidden">
        {/* Post Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="relative">
            <Avatar className="w-11 h-11 ring-2 ring-offset-1 ring-transparent group-hover:ring-indigo-100 transition-all duration-300">
              <AvatarImage src={author?.photo_url} />
              <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white font-bold text-sm`}>
                {author?.full_name?.charAt(0) || author?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight">
              {author?.full_name || author?.email || 'Usuário'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDistanceToNow(new Date(post.created_date), {
                addSuffix: true,
                locale: pt
              })}
            </p>
          </div>

          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-gray-100">
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg cursor-pointer gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir publicação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Post Content */}
        {post.content && (
          <div className="px-5 mb-4">
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          </div>
        )}

        {/* Images */}
        {post.photo_urls?.length > 0 && (
          <div className="px-5">
            {renderImages()}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <button
              onClick={() => onLike(post)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                hasLiked
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                  : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'
              }`}
            >
              <Heart className={`w-4 h-4 transition-all duration-200 ${hasLiked ? 'fill-current scale-110' : ''}`} />
              <span>{likeCount > 0 ? likeCount : ''} {likeCount === 1 ? 'curtida' : likeCount > 1 ? 'curtidas' : 'Curtir'}</span>
            </button>

            {post.updated_date && post.updated_date !== post.created_date && (
              <span className="text-xs text-gray-300">
                Editado em {format(new Date(post.updated_date), "dd/MM 'às' HH:mm")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0 bg-black/95 border-0 rounded-2xl overflow-hidden">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            <img
              src={post.photo_urls?.[lightboxIndex]}
              alt={`Imagem ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-full object-contain"
            />

            {post.photo_urls?.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all duration-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all duration-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {post.photo_urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className={`rounded-full transition-all duration-200 ${i === lightboxIndex ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Deseja realmente excluir este post?"
        description="Esta ação marcará o post como excluído. Um administrador poderá restaurá-lo da lixeira."
        itemName="Post"
        isPermanent={false}
      />
    </>
  );
}