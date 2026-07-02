import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, X, ImageIcon, Smile } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';

export default function PostForm({ user, onPost }) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;
    setIsPosting(true);
    try {
      await onPost({
        content: content.trim(),
        photo_urls: attachments,
        visibility: 'company'
      });
      setContent('');
      setAttachments([]);
      setIsFocused(false);
    } catch (error) {
      console.error('Erro ao postar:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          if (file.size > 10 * 1024 * 1024) {
            alert(`A imagem "${file.name}" é muito grande. Tamanho máximo: 10MB`);
            continue;
          }
          const response = await UploadFile({ file });
          setAttachments(prev => [...prev, response.file_url]);
        } else {
          alert(`O arquivo "${file.name}" não é uma imagem válida.`);
        }
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem: ' + (error.message || error));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const hasContent = content.trim() || attachments.length > 0;

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 shadow-sm overflow-hidden ${isFocused ? 'border-indigo-200 shadow-indigo-100/60 shadow-md' : 'border-gray-100'}`}>
      {/* Top accent bar */}
      <div className={`h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />

      <form onSubmit={handleSubmit} className="p-5">
        {/* Hidden input rendered unconditionally so labels can always target it */}
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="post-file-upload"
          disabled={isUploading}
        />

        <div className="flex gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-indigo-100 flex-shrink-0 mt-1">
            <AvatarImage src={user?.photo_url} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !hasContent && setIsFocused(false)}
                placeholder={`O que você quer compartilhar, ${user?.full_name?.split(' ')[0] || 'colega'}?`}
                rows={isFocused || hasContent ? 3 : 1}
                className="w-full resize-none bg-gray-50 hover:bg-gray-50/80 focus:bg-white border border-gray-200 focus:border-indigo-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-100 leading-relaxed"
              />
            </div>

            {/* Image preview grid */}
            {attachments.length > 0 && (
              <div className={`grid gap-2 ${attachments.length === 1 ? 'grid-cols-1' : attachments.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {attachments.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {(isFocused || hasContent) && (
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="post-file-upload"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isUploading
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5" />
                        Foto
                        {attachments.length > 0 && (
                          <span className="bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 text-xs font-bold">
                            {attachments.length}
                          </span>
                        )}
                      </>
                    )}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setContent(''); setAttachments([]); setIsFocused(false); }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <Button
                    type="submit"
                    disabled={!hasContent || isPosting}
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl px-4 shadow-sm hover:shadow-md transition-all duration-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed gap-1.5"
                  >
                    {isPosting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Publicar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inactive placeholder hint */}
        {!isFocused && !hasContent && (
          <div className="mt-3 ml-[52px] flex items-center gap-4">
            <label
              htmlFor="post-file-upload"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 cursor-pointer transition-colors"
              onClick={() => setIsFocused(true)}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Foto
            </label>
          </div>
        )}
      </form>
    </div>
  );
}