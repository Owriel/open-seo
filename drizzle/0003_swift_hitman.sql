-- Añade columna para almacenar tipos Schema.org (JSON-LD) detectados por el crawler.
-- Formato: JSON array stringificado, ej: '["LocalBusiness","BreadcrumbList"]'.
-- NULL = pagina auditada antes de que existiese la columna (se trata como array vacio).
ALTER TABLE `audit_pages` ADD `schema_types_json` text;
