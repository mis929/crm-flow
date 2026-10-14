import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wwttrytawgyeehfjqufc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dHRyeXRhd2d5ZWVoZmpxdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTAzODgsImV4cCI6MjA5NTAyNjM4OH0.YBEWAWI-5P1b-IiCkwY5zAIu8t-yY0O00WRgclb9Ff4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);