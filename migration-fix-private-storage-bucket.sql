-- ============================================================
-- ALTO: "UploadPrivateFile" (usado para certificados digitais
-- .pfx de assinatura fiscal em FiscalSettings.jsx e XMLs de nota
-- fiscal em Invoices.jsx) gravava no MESMO bucket público
-- "uploads" (public: true) usado pelo UploadFile normal, só
-- prefixando o caminho com "private/", e devolvia getPublicUrl()
-- em vez de uma URL assinada. "Privado" era só uma convenção de
-- nome de pasta: qualquer pessoa com a URL (previsível:
-- private/<timestamp>_<nome-do-arquivo>) baixava o certificado
-- .pfx (chave de assinatura fiscal da empresa) ou o XML da nota
-- fiscal sem autenticação nenhuma.
--
-- Cria um bucket realmente privado (public: false), com RLS por
-- CNPJ — o primeiro segmento do caminho do objeto precisa ser o
-- cnpj do usuário autenticado — e sem nenhuma policy de leitura
-- pública/anônima.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('private-uploads', 'private-uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "private_uploads_select" ON storage.objects;
DROP POLICY IF EXISTS "private_uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "private_uploads_delete" ON storage.objects;

CREATE POLICY "private_uploads_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-uploads'
    AND (storage.foldername(name))[1] IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "private_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'private-uploads'
    AND (storage.foldername(name))[1] IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "private_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'private-uploads'
    AND (storage.foldername(name))[1] IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
  );

-- Nota: os arquivos já enviados anteriormente ao bucket público
-- "uploads" sob o prefixo "private/" (certificados .pfx e XMLs já
-- cadastrados em fiscal_settings.prod_pfx_uri / hml_pfx_uri e
-- invoices.xml_file_uri) continuam acessíveis pela URL pública
-- antiga — essa migration só protege os PRÓXIMOS uploads. Se
-- necessário, mova manualmente os arquivos existentes para o novo
-- bucket "private-uploads" e re-cadastre os certificados na tela
-- de Configurações Fiscais.

-- Conferir depois de rodar:
-- SELECT * FROM storage.buckets WHERE id = 'private-uploads';
-- SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'private_uploads%';
