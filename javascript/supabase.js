"use strict";

(function () {
    const SUPABASE_URL =
        "https://zvyjberdjonlkgnexcdm.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_IbK4QaSYOa6CJJEhyg5UaA_nSRaO54u";

    function initializeSupabase() {
        if (!window.supabase) {
            console.error(
                "Bizora: Supabase library did not load."
            );
            return;
        }

        if (window.bizoraSupabase) {
            return;
        }

        try {
            window.bizoraSupabase = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );

            console.log(
                "Bizora: Supabase initialized successfully."
            );
        } catch (error) {
            console.error(
                "Bizora: Supabase initialization failed.",
                error
            );
        }
    }

    initializeSupabase();
})();
