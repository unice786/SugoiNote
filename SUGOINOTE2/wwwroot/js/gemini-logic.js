const SugoiNoteIA = {
    // Función para generar el resumen
    async resumirApunte(apunteId) {
        console.log("Generando resumen para: " + apunteId);

        const response = await fetch(`/IA/GenerarResumen?id=${apunteId}`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('resumen-container').innerText = data.resumen;
            alert("¡Resumen listo! ✨");
        } else {
            alert("Error al conectar con Gemini");
        }
    },

    // Guardado automático
    autoSave(contenido) {
        localStorage.setItem('temp_note', contenido);
        console.log("Borrador guardado localmente...");
    }
};