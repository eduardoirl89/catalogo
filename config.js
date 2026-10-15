// =========================================================================
// CONFIGURACIÓN GLOBAL DEL PROYECTO
// Añade este archivo a .gitignore si NO quieres subir tus URLs reales.
// =========================================================================

window.APP_CONFIG = {
    // 1. URL CSV de productos (Google Sheets → Publicar en la web → CSV)
    PRODUCTS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=412358378&single=true&output=csv",

    // 2. URL CSV de la empresa (Google Sheets → Publicar en la web → CSV)
    COMPANY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=456193246&single=true&output=csv",

    // 3. Supabase Storage
    SUPABASE_PROJECT_URL: "https://svruhyxfrfcafqjyziys.supabase.co",
    SUPABASE_BUCKET_NAME: "imagenes-catalogo",

    // 4. WhatsApp (número con código de país, sin +, sin espacios, sin guiones)
    WHATSAPP_NUMBER: "584220396308",
    WHATSAPP_MESSAGE: "Hola, te comparto el catálogo digital de productos:",

    // 5. Opciones de comportamiento
    INCLUDE_COVER_ON_PRINT: true,   // false = omite la portada al exportar PDF
    SEARCH_DEBOUNCE_MS: 200,
    ENABLE_DEBUG_LOGS: true,

    // 6. Columnas máximas en la grilla web (se adapta hacia abajo en responsive)
    GRID_MAX_COLS: 5
};