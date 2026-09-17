# Lift Log Pro

# MALITOS PREMIUM CHECK

Quiero crear una aplicación web y móvil llamada **Malitos Premium Check**.

Su objetivo es convertirse en mi diario definitivo de entrenamiento de CrossFit. La aplicación debe sustituir completamente mi libreta de entrenamiento y estar diseñada específicamente para seguir la planificación que adjunto en un archivo Excel.

La aplicación debe leer e interpretar automáticamente el Excel, utilizando la planificación como fuente principal. Esa planificación será de solo lectura y nunca podrá modificarse. Únicamente se podrán registrar mis resultados personales.

La aplicación debe ser extremadamente rápida, moderna y optimizada para móvil, aunque también debe funcionar perfectamente en escritorio.

--------------------------------------------------

IMPORTACIÓN DEL EXCEL

--------------------------------------------------

Voy a adjuntar un archivo Excel que contiene toda mi planificación anual.

La aplicación debe:

• Leer automáticamente todas las hojas del Excel.

• Detectar meses, semanas y días.

• Interpretar correctamente la estructura de la planificación.

• Mantener exactamente el mismo orden del documento.

• Poder importar futuras versiones del Excel sin perder ninguno de mis datos personales.

Debe existir un botón llamado:

"Actualizar planificación"

Al importar una nueva versión del Excel:

• Se actualiza únicamente la programación.

• Se conservan todos mis registros.

• Nunca se borran mis pesos.

• Nunca se borran mis PR.

• Nunca se borran mis tiempos.

• Nunca se borran mis notas.

--------------------------------------------------

DISEÑO

--------------------------------------------------

Quiero un diseño premium.

Inspiración:

• BTWB

• SugarWOD

• Strong

• Whoop

Tema oscuro.

Colores:

Fondo negro.

Grises oscuros.

Texto blanco.

Detalles dorados para récords y logros.

Diseño minimalista.

Mucho espacio entre elementos.

Animaciones suaves.

Totalmente responsive.

--------------------------------------------------

PANTALLA PRINCIPAL

--------------------------------------------------

Mostrar:

Entrenamiento de hoy

Próximo entrenamiento

Entrenamientos completados

Racha de entrenamiento

Último PR conseguido

Peso total movido esta semana

Tiempo entrenado esta semana

Acceso rápido a:

Calendario

Historial

PR

Estadísticas

--------------------------------------------------

CALENDARIO

--------------------------------------------------

Vista mensual.

Cada día debe aparecer como:

✔ Completado

○ Pendiente

Descanso

Al pulsar un día debe abrir exactamente el entrenamiento correspondiente del Excel.

--------------------------------------------------

PANTALLA DEL ENTRENAMIENTO

--------------------------------------------------

Debe respetar exactamente la estructura original.

Mostrar bloques como:

Zona Media

Mobility

Warm Up

Parte A

Parte B

Parte C

Parte D

Cada bloque debe permitir registrar:

Peso

Series

Repeticiones

Tiempo

RPE

Escala utilizada

Notas

Vídeo opcional

Fotografía opcional

Cada entrenamiento podrá marcarse como:

Completado

No realizado

Modificado

--------------------------------------------------

DETECCIÓN AUTOMÁTICA DE EJERCICIOS

--------------------------------------------------

La aplicación debe reconocer automáticamente ejercicios como:

Back Squat

Front Squat

Deadlift

Romanian Deadlift

Bench Press

Strict Press

Push Press

Push Jerk

Split Jerk

Thruster

Power Clean

Squat Clean

Hang Clean

Clean & Jerk

Power Snatch

Squat Snatch

Hang Snatch

Overhead Squat

Pendlay Row

Hip Thrust

Pull Up

Chest To Bar

Muscle Up

Toes To Bar

Wall Ball

Burpees

Double Unders

Remo

Bike

Ski Erg

Farmer Carry

Lunges

Y cualquier otro movimiento que aparezca en la planificación.

--------------------------------------------------

ASISTENTE INTELIGENTE

--------------------------------------------------

Esta es una de las funciones más importantes.

Cuando un entrenamiento indique:

75%

80%

85%

90%

95%

o cualquier porcentaje,

la aplicación debe calcular automáticamente el peso recomendado utilizando mi mejor marca registrada.

Ejemplo:

Si mi Back Squat es 150 kg

y el entrenamiento dice

5x5 al 75%

la aplicación mostrará automáticamente:

Peso recomendado:

112,5 kg

Debe redondear automáticamente al disco disponible más cercano.

Lo mismo para:

Snatch

Clean

Deadlift

Press

Bench

Front Squat

Thruster

etc.

--------------------------------------------------

HISTORIAL DE EJERCICIOS

--------------------------------------------------

Cada ejercicio tendrá su propia ficha.

Ejemplo:

BACK SQUAT

Mostrar:

Último entrenamiento

Mejor peso

Peso medio

Número de sesiones

Gráfico de evolución

Historial completo

Todas las notas

Todos los vídeos

Todas las fechas

--------------------------------------------------

PERSONAL RECORDS

--------------------------------------------------

Crear una pantalla exclusiva.

Mostrar automáticamente:

1RM

2RM

3RM

5RM

10RM

Peso máximo

Mayor volumen

Mayor número de repeticiones

Fecha

Historial

Cuando consiga un nuevo PR deberá aparecer una animación celebrándolo.

--------------------------------------------------

BENCHMARKS

--------------------------------------------------

Detectar automáticamente benchmarks como:

Fran

Grace

Helen

Murph

Diane

Karen

Fight Gone Bad

Open

Quarterfinals

Semifinals

Games

Guardar automáticamente:

Tiempo

Peso

Escalado

Notas

Comparativa con intentos anteriores

--------------------------------------------------

ESTADÍSTICAS

--------------------------------------------------

Mostrar:

Entrenamientos realizados

Peso total movido

Peso medio

Horas entrenadas

Volumen semanal

Volumen mensual

Volumen anual

Ejercicios más realizados

Peso máximo levantado

PR conseguidos

Racha actual

Racha máxima

Tiempo medio por entrenamiento

Gráficas de evolución.

--------------------------------------------------

NOTAS

--------------------------------------------------

Cada entrenamiento tendrá un apartado para registrar:

Sueño

Energía

Fatiga

Dolor

Movilidad

Alimentación

Estado de ánimo

Comentarios

--------------------------------------------------

BUSCADOR

--------------------------------------------------

Buscador global.

Debe encontrar:

Ejercicios

Fechas

Entrenamientos

Notas

PR

Benchmarks

--------------------------------------------------

EXPORTAR

--------------------------------------------------

Permitir exportar:

Excel

CSV

PDF

Con todos mis registros.

--------------------------------------------------

BASE DE DATOS

--------------------------------------------------

No quiero login.

No quiero usuarios.

Todo pertenece a un único deportista.

Guardar automáticamente todos los datos.

La aplicación nunca debe perder información.

--------------------------------------------------

ARQUITECTURA

--------------------------------------------------

Utilizar tecnologías modernas.

React

TypeScript

TailwindCSS

Supabase únicamente como base de datos (sin autenticación).

Código limpio.

Componentes reutilizables.

Carga rápida.

Preparada para convertirse en una PWA instalable en Android, iPhone y ordenador.

--------------------------------------------------

OBJETIVO FINAL

--------------------------------------------------

Quiero una aplicación premium, rápida, elegante y extremadamente útil para registrar toda mi evolución deportiva durante años. Debe convertirse en mi herramienta principal para seguir mi planificación de CrossFit, registrar pesos, tiempos, récords, estadísticas y progreso, ofreciendo una experiencia superior a una libreta de entrenamiento y adaptada específicamente al Excel que adjunto.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rmordie.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7d341c60-7363-4d42-97cb-2683b12ebc0a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
