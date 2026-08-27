CREATE POLICY "social media read" ON storage.objects FOR SELECT USING (bucket_id = 'social');
CREATE POLICY "social media insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'social');
CREATE POLICY "social media update" ON storage.objects FOR UPDATE USING (bucket_id = 'social');
CREATE POLICY "social media delete" ON storage.objects FOR DELETE USING (bucket_id = 'social');