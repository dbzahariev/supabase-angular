-- Проверка на текущата структура на таблицата matches
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'matches'
ORDER BY 
    ordinal_position;
