-- Voice Input Improvements
-- Ensure voice_commands table has all needed fields and improve parse_voice_command function

-- Add parsed_items column if it doesn't exist (for easier querying)
alter table public.voice_commands
    add column if not exists parsed_items jsonb;

-- Update voice_commands to store improved transcript
alter table public.voice_commands
    add column if not exists improved_transcript text;

-- Ensure inventory table has all needed columns for voice input
-- Note: confidence_score already exists as 'real' type in init.sql, so we only add it if it doesn't exist
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'inventory' 
        and column_name = 'confidence_score'
    ) then
        alter table public.inventory
            add column confidence_score real check (confidence_score between 0 and 1) default 0.9;
    end if;
end $$;

-- Note: quantity_approx is already nullable in the schema, so no need to alter it

-- Create index for faster inventory queries
create index if not exists idx_inventory_user_created 
    on public.inventory(user_id, created_at desc);

-- Ensure RLS policies allow inserts
-- Check if inventory insert policy exists and is correct
do $$
begin
    -- Drop existing policy if it exists and recreate to ensure it works
    drop policy if exists "Inventory maintainable by owner" on public.inventory;
    
    create policy "Inventory maintainable by owner" on public.inventory
        for all 
        using (auth.uid() = user_id) 
        with check (auth.uid() = user_id);
end $$;

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all on public.inventory to authenticated;
grant execute on function public.estimate_expiry_date(text) to authenticated;
grant execute on function public.detect_category(text) to authenticated;

-- Update parse_voice_command function
-- Note: This function is kept for backward compatibility
-- The frontend now uses AI parsing directly via parseVoiceCommandWithAI
create or replace function parse_voice_command(
    p_user_id uuid,
    p_command_text text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
    v_items jsonb;
begin
    -- Return empty items - frontend handles AI parsing
    -- This function is kept for backward compatibility
    v_items := '[]'::jsonb;
    
    v_result := jsonb_build_object(
        'success', true,
        'items', v_items,
        'error', null
    );
    
    return v_result;
end;
$$;

-- Grant execute permissions
grant execute on function parse_voice_command(uuid, text) to authenticated;
grant execute on function parse_voice_command(uuid, text) to anon;

comment on function parse_voice_command is 'Parse voice command text into structured inventory updates. Frontend uses AI parsing directly.';

-- Create index for faster queries on voice commands
create index if not exists idx_voice_commands_success 
    on public.voice_commands(user_id, success, created_at desc);

