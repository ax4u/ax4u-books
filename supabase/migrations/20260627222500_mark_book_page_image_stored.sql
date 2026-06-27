create or replace function public.mark_book_page_image_stored(
  p_book_id uuid,
  p_page_index integer,
  p_image_path text,
  p_image_mime text,
  p_image_width integer,
  p_image_height integer,
  p_image_bytes integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_first_image_index integer;
begin
  select min(coalesce((page->>'index')::integer, ordinality::integer - 1))
  into v_first_image_index
  from public.books b,
       jsonb_array_elements(b.pages) with ordinality as elem(page, ordinality)
  where b.id = p_book_id
    and (
      nullif(page->>'imagePath', '') is not null
      or nullif(page->>'image', '') is not null
    );

  update public.books b
  set pages = coalesce(
        (
          select jsonb_agg(
            case
              when coalesce((page->>'index')::integer, ordinality::integer - 1) = p_page_index
              then page - 'image' - 'imageAvailable' || jsonb_build_object(
                'image', null,
                'imagePath', p_image_path,
                'imageMime', p_image_mime,
                'imageWidth', p_image_width,
                'imageHeight', p_image_height,
                'imageBytes', p_image_bytes
              )
              else page
            end
            order by ordinality
          )
          from jsonb_array_elements(b.pages) with ordinality as elem(page, ordinality)
        ),
        '[]'::jsonb
      ),
      cover_image_path = case
        when b.cover_image_path is null and v_first_image_index = p_page_index
        then p_image_path
        else b.cover_image_path
      end,
      updated_at = now()
  where b.id = p_book_id;
end;
$$;

grant execute on function public.mark_book_page_image_stored(
  uuid,
  integer,
  text,
  text,
  integer,
  integer,
  integer
) to authenticated;
