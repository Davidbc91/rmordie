# Roadmap

## Notificaciones push del chat (completado en código)
- [x] Tabla push_subscriptions (solo dispositivos con permiso)
- [x] Claves VAPID como secretos
- [x] Service worker de push + apertura del chat
- [x] Permiso de notificaciones (con guía iPhone)
- [x] Envío al crear mensaje, excluyendo remitente y chat abierto
- [x] Contador de mensajes no leídos + marca de leído
- [x] Helper genérico para futuras notificaciones
- [ ] Prueba real en iPhone (añadir a pantalla de inicio y recibir aviso)

## Modo offline (completado)
- [x] Almacenamiento local (IndexedDB) de planificación, resultados, RM y perfil
- [x] Cola de cambios offline con reintentos y sin duplicados
- [x] Sincronización automática al recuperar conexión + detección de conflictos
- [x] Indicador de estado de conexión/sincronización
- [x] App abre sin conexión (service worker offline + push)
- [x] Chat muestra aviso "necesita conexión"
- [x] Pruebas offline reales verificadas; sin duplicados en la base de datos
- [ ] Prueba real de notificaciones push en iPhone (pendiente del usuario)
