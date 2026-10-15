// =========================================================================
// CONFIGURACIÓN GLOBAL DEL PROYECTO
// =========================================================================

window.APP_CONFIG = {

    // ---------------------------------------------------------------------
    // 1. FUENTES DE DATOS (Google Sheets → Publicar en la web → CSV)
    // ---------------------------------------------------------------------
    PRODUCTS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=412358378&single=true&output=csv",
    COMPANY_CSV_URL:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=456193246&single=true&output=csv",

    // ---------------------------------------------------------------------
    // 2. SUPABASE STORAGE
    // ---------------------------------------------------------------------
    SUPABASE_PROJECT_URL: "https://svruhyxfrfcafqjyziys.supabase.co",
    SUPABASE_BUCKET_NAME: "imagenes-catalogo",
    IMAGE_WIDTH: 350,
    IMAGE_QUALITY: 70,

    // ---------------------------------------------------------------------
    // 3. WHATSAPP
    // ---------------------------------------------------------------------
    WHATSAPP_NUMBER: "584220396308",

    // Mensaje al pulsar "Escribir" (chat directo con la empresa)
    WHATSAPP_MESSAGE_TO_COMPANY: "Hola, quisiera más información sobre el catálogo de productos.",

    // Mensaje al pulsar "Compartir" (a cualquier contacto)
    WHATSAPP_MESSAGE_SHARE: "Hola, te comparto el catálogo digital de productos:",

    // ---------------------------------------------------------------------
    // 4. COMPORTAMIENTO
    // ---------------------------------------------------------------------
    INCLUDE_COVER_ON_PRINT: true,
    SEARCH_DEBOUNCE_MS: 200,
    ENABLE_DEBUG_LOGS: true,

    // ---------------------------------------------------------------------
    // 5. GRILLA
    // ---------------------------------------------------------------------
    GRID_MAX_COLS: 5
};