"""Hook de ZAP para el escaneo de la API de SugoiNote.

Todas las rutas privadas exigen `Authorization: Bearer <token>`. ZAP no acepta
esa cabecera por linea de comandos, asi que se agrega con la regla del
complemento Replacer en cada peticion que salga del escaneo.

El token llega por la variable de entorno ZAP_TOKEN.
"""

import os


def _agregar_regla(zap, token):
    # El cliente Python de ZAP no usa el mismo nombre para los argumentos en
    # todas las versiones del complemento, asi que se intentan las dos formas.
    try:
        zap.replacer.add_rule(
            description="Sesion de SugoiNote",
            enabled="true",
            matchType="REQ_HEADER",
            matchString="Authorization",
            replacement="Bearer " + token,
        )
    except TypeError:
        zap.replacer.add_rule(
            description="Sesion de SugoiNote",
            enabled="true",
            matchtype="REQ_HEADER",
            matchstr="Authorization",
            replacement="Bearer " + token,
        )


def zap_started(zap, target):
    token = os.environ.get("ZAP_TOKEN", "").strip()
    if not token:
        print("AVISO: ZAP_TOKEN vacio, el escaneo correra sin sesion")
        return
    try:
        _agregar_regla(zap, token)
        print("Regla de Replacer agregada: Authorization: Bearer <token>")
    except Exception as error:  # noqa: BLE001 - se informa y se sigue sin sesion
        print(f"AVISO: no se pudo agregar la cabecera de sesion: {error!r}")
