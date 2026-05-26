import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uvqxkjqxcqovhkazaxbq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cXhranF4Y3FvdmhrYXpheGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDMxMTgsImV4cCI6MjA5NTMxOTExOH0.0crvEYZol8Jrqwjj6i9g8PO3jsXBnLGmeFDielhEPh0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
