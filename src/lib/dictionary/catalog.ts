import type { Movement, MovementLevel } from "./types";

type Seed = [string, string, string, string, string, MovementLevel?, boolean?];
// Canonical IDs are deliberately independent from labels; append new entries instead of reordering IDs.
const seeds: Seed[] = [
  ["Squat", "Sentadilla", "squat", "Barra", "Fuerza"],
  ["Front Squat", "Sentadilla frontal", "front squat", "Barra", "Fuerza"],
  ["Back Squat", "Sentadilla trasera", "back squat", "Barra", "Fuerza"],
  ["Overhead Squat", "Sentadilla sobre la cabeza", "overhead squat", "Barra", "Fuerza", "Advanced"],
  ["Goblet Squat", "Sentadilla goblet", "goblet squat", "Kettlebell o mancuerna", "Fuerza"],
  ["Deadlift", "Peso muerto", "deadlift", "Barra", "Fuerza"],
  ["Sumo Deadlift", "Peso muerto sumo", "sumo deadlift", "Barra", "Fuerza"],
  ["Romanian Deadlift", "Peso muerto rumano", "rdl", "Barra o mancuernas", "Fuerza"],
  ["Clean", "Cargada", "clean", "Barra", "Halterofilia", "Intermediate"],
  ["Power Clean", "Cargada de potencia", "power clean", "Barra", "Halterofilia", "Intermediate"],
  ["Squat Clean", "Cargada en sentadilla", "full clean", "Barra", "Halterofilia", "Advanced"],
  ["Hang Clean", "Cargada desde hang", "hang clean", "Barra", "Halterofilia", "Intermediate"],
  ["Snatch", "Arrancada", "snatch", "Barra", "Halterofilia", "Advanced"],
  [
    "Power Snatch",
    "Arrancada de potencia",
    "power snatch",
    "Barra",
    "Halterofilia",
    "Intermediate",
  ],
  ["Squat Snatch", "Arrancada en sentadilla", "full snatch", "Barra", "Halterofilia", "Advanced"],
  ["Hang Snatch", "Arrancada desde hang", "hang snatch", "Barra", "Halterofilia", "Advanced"],
  ["Clean & Jerk", "Cargada y envión", "clean jerk", "Barra", "Halterofilia", "Advanced"],
  ["Push Press", "Press con impulso", "push press", "Barra", "Fuerza"],
  ["Strict Press", "Press estricto", "military press|shoulder press", "Barra", "Fuerza"],
  ["Push Jerk", "Jerk con impulso", "push jerk", "Barra", "Halterofilia", "Intermediate"],
  ["Split Jerk", "Jerk en split", "split jerk", "Barra", "Halterofilia", "Advanced"],
  ["Thruster", "Thruster", "sentadilla con press", "Barra", "Fuerza"],
  ["Bench Press", "Press de banca", "bench press", "Barra y banco", "Fuerza"],
  ["Dumbbell Press", "Press con mancuernas", "db press", "Mancuernas", "Fuerza"],
  ["Pull-up", "Dominada", "pullup", "Barra de dominadas", "Gimnásticos"],
  ["Chest-to-Bar", "Dominada al pecho", "c2b", "Barra de dominadas", "Gimnásticos", "Intermediate"],
  ["Toes-to-Bar", "Pies a la barra", "t2b", "Barra de dominadas", "Gimnásticos", "Intermediate"],
  [
    "Knees-to-Elbows",
    "Rodillas a codos",
    "k2e",
    "Barra de dominadas",
    "Gimnásticos",
    "Intermediate",
  ],
  [
    "Bar Muscle-Up",
    "Muscle-up en barra",
    "bar muscleup",
    "Barra de dominadas",
    "Gimnásticos",
    "Advanced",
  ],
  ["Ring Muscle-Up", "Muscle-up en anillas", "ring muscleup", "Anillas", "Gimnásticos", "Advanced"],
  ["Ring Row", "Remo en anillas", "ring row", "Anillas", "Gimnásticos"],
  ["Handstand Push-Up", "Flexión de pino", "hspu", "Pared", "Gimnásticos", "Advanced"],
  [
    "Strict Handstand Push-Up",
    "Flexión estricta de pino",
    "strict hspu",
    "Pared",
    "Gimnásticos",
    "Advanced",
  ],
  ["Handstand Hold", "Mantenimiento de pino", "handstand hold", "Pared o suelo", "Gimnásticos"],
  ["Handstand Walk", "Caminar en pino", "hsw", "Suelo", "Gimnásticos", "Advanced"],
  ["Pistol Squat", "Sentadilla a una pierna", "pistol", "Suelo", "Gimnásticos", "Advanced"],
  [
    "Bulgarian Split Squat",
    "Sentadilla búlgara",
    "bulgarian split squat",
    "Banco y mancuernas",
    "Fuerza",
  ],
  ["Lunges", "Zancadas", "lunge|walking lunge", "Peso corporal o carga", "Fuerza"],
  ["Box Step-Up", "Subida al cajón", "step up", "Cajón", "Pliometría"],
  ["Box Jump", "Salto al cajón", "box jump", "Cajón", "Pliometría"],
  ["Box Jump Over", "Salto por encima del cajón", "box over", "Cajón", "Pliometría"],
  ["Broad Jump", "Salto horizontal", "broad jump", "Suelo", "Pliometría"],
  ["Burpee", "Burpee", "burpee", "Suelo", "Metabólico"],
  ["Burpee Box Jump Over", "Burpee y salto sobre cajón", "bbjo", "Cajón", "Metabólico"],
  [
    "Wall Ball",
    "Lanzamiento de balón a pared",
    "wallball",
    "Balón medicinal y pared",
    "Metabólico",
  ],
  [
    "Kettlebell Swing",
    "Balanceo de kettlebell",
    "american swing|kb swing",
    "Kettlebell",
    "Metabólico",
  ],
  [
    "Russian Kettlebell Swing",
    "Balanceo ruso de kettlebell",
    "russian swing",
    "Kettlebell",
    "Metabólico",
  ],
  [
    "Turkish Get-Up",
    "Levantamiento turco",
    "tgu",
    "Kettlebell o mancuerna",
    "Fuerza",
    "Intermediate",
  ],
  ["Dumbbell Snatch", "Arrancada con mancuerna", "db snatch", "Mancuerna", "Halterofilia"],
  ["Dumbbell Clean", "Cargada con mancuernas", "db clean", "Mancuernas", "Halterofilia"],
  [
    "Dumbbell Clean & Jerk",
    "Cargada y envión con mancuernas",
    "db clean jerk",
    "Mancuernas",
    "Halterofilia",
    "Intermediate",
  ],
  [
    "Dumbbell Shoulder-to-Overhead",
    "Mancuernas de hombros a arriba",
    "db s2oh",
    "Mancuernas",
    "Fuerza",
  ],
  [
    "Devil's Press",
    "Devil's press",
    "devil press|devils press",
    "Mancuernas",
    "Metabólico",
    "Intermediate",
  ],
  [
    "Farmer Carry",
    "Paseo del granjero",
    "farmers walk",
    "Mancuernas o kettlebells",
    "Acondicionamiento",
  ],
  [
    "Front Rack Carry",
    "Paseo en front rack",
    "front rack carry",
    "Barra o kettlebells",
    "Acondicionamiento",
  ],
  [
    "Overhead Carry",
    "Paseo sobre la cabeza",
    "overhead carry",
    "Kettlebell, mancuerna o barra",
    "Acondicionamiento",
  ],
  ["Sled Push", "Empuje de trineo", "sled push", "Trineo", "Acondicionamiento"],
  ["Sled Pull", "Arrastre de trineo", "sled pull", "Trineo y cuerda", "Acondicionamiento"],
  ["Rope Climb", "Trepa de cuerda", "rope climb", "Cuerda", "Gimnásticos", "Intermediate"],
  [
    "Legless Rope Climb",
    "Trepa de cuerda sin piernas",
    "legless rope climb",
    "Cuerda",
    "Gimnásticos",
    "Advanced",
  ],
  ["Double Under", "Doble salto de comba", "du", "Comba", "Metabólico", "Intermediate"],
  ["Single Under", "Salto simple de comba", "su", "Comba", "Metabólico"],
  ["GHD Sit-Up", "Abdominal en GHD", "ghd situp", "GHD", "Gimnásticos", "Intermediate"],
  ["GHD Hip Extension", "Extensión de cadera en GHD", "hip extension", "GHD", "Fuerza"],
  ["Back Extension", "Extensión lumbar", "back extension", "Banco romano o GHD", "Fuerza"],
  ["Sit-Up", "Abdominal", "situp", "Suelo", "Gimnásticos"],
  ["Row", "Remo ergómetro", "rowing erg", "Remoergómetro", "Cardio"],
  ["SkiErg", "SkiErg", "ski erg", "SkiErg", "Cardio"],
  ["BikeErg", "BikeErg", "bike erg", "BikeErg", "Cardio"],
  [
    "Assault Bike / Echo Bike",
    "Bicicleta de aire",
    "air bike|echo bike",
    "Bicicleta de aire",
    "Cardio",
  ],
  ["Running", "Carrera", "run|correr", "Ninguno", "Cardio"],
  ["Swimming", "Natación", "swim|nadar", "Piscina", "Cardio"],
];

const categoryMuscles: Record<string, string[]> = {
  Fuerza: ["Cuádriceps", "Glúteos", "Core"],
  Halterofilia: ["Piernas", "Glúteos", "Espalda", "Hombros"],
  Gimnásticos: ["Espalda", "Hombros", "Brazos", "Core"],
  Pliometría: ["Glúteos", "Cuádriceps", "Gemelos"],
  Metabólico: ["Piernas", "Core", "Hombros"],
  Acondicionamiento: ["Piernas", "Core", "Agarre"],
  Cardio: ["Sistema cardiovascular", "Piernas", "Core"],
};

const categoryCues: Record<
  string,
  {
    description: string;
    technique: string[];
    mistakes: string[];
    progressions: string[];
    regressions: string[];
  }
> = {
  Fuerza: {
    description:
      "Desarrolla fuerza mediante un recorrido controlado y posiciones estables. Ajusta la carga al rango de movimiento que puedas mantener con buena técnica.",
    technique: [
      "Ajusta la postura inicial y crea tensión antes de mover la carga.",
      "Mantén el tronco firme y la carga cerca de una trayectoria controlada.",
      "Completa cada repetición con control, sin perder equilibrio ni alineación.",
    ],
    mistakes: [
      "Perder tensión del tronco bajo carga.",
      "Dejar que rodillas u hombros colapsen fuera de su línea estable.",
      "Aumentar el peso sacrificando recorrido y control.",
    ],
    progressions: [
      "Añade carga en incrementos pequeños cuando todas las repeticiones sean sólidas.",
      "Progresa a pausas o rangos completos antes de aumentar volumen.",
    ],
    regressions: [
      "Reduce la carga y practica el patrón con tempo lento.",
      "Usa una variante con apoyo o rango cómodo mientras mejoras movilidad.",
    ],
  },
  Halterofilia: {
    description:
      "Movimiento de halterofilia que combina posiciones precisas, aceleración de la carga y una recepción estable. Practícalo primero con una carga ligera.",
    technique: [
      "Mantén la barra cerca del cuerpo y la espalda firme al despegar.",
      "Extiende cadera y piernas antes de acelerar con los brazos.",
      "Recibe la carga con pies estables y termina en control.",
    ],
    mistakes: [
      "Separar la barra del cuerpo durante el tirón.",
      "Tirar pronto con los brazos y perder la extensión de cadera.",
      "Recibir con una base inestable o sin fijar la carga.",
    ],
    progressions: [
      "Practica posiciones parciales y pausas con PVC o barra ligera.",
      "Aumenta carga poco a poco solo cuando la recepción sea consistente.",
    ],
    regressions: [
      "Reduce la carga y trabaja el patrón desde una posición elevada.",
      "Separa el tirón y la recepción en ejercicios técnicos simples.",
    ],
  },
  Gimnásticos: {
    description:
      "Movimiento de control corporal que requiere coordinación, fuerza relativa y un rango de movimiento apropiado a tu nivel.",
    technique: [
      "Activa hombros y abdomen antes de iniciar cada repetición.",
      "Mantén una forma corporal consistente durante el recorrido.",
      "Completa la repetición con control y descansa antes de perder calidad.",
    ],
    mistakes: [
      "Perder tensión corporal y dejar que la zona lumbar se arquee.",
      "Acortar el rango para acumular repeticiones rápidas.",
      "Forzar una variante para la que aún falta control o fuerza.",
    ],
    progressions: [
      "Aumenta gradualmente el rango, las repeticiones o la dificultad, una variable cada vez.",
      "Consolida series pequeñas con técnica repetible antes de enlazarlas.",
    ],
    regressions: [
      "Usa una banda, apoyo o variante horizontal para reducir la carga.",
      "Practica posiciones isométricas y repeticiones asistidas.",
    ],
  },
  Pliometría: {
    description:
      "Ejercicio explosivo que entrena la producción y absorción de fuerza. Prioriza aterrizajes seguros y una altura adecuada.",
    technique: [
      "Carga cadera y piernas antes del despegue.",
      "Aterriza con ambos pies y absorbe el impacto flexionando caderas y rodillas.",
      "Recupera una posición estable antes de iniciar el siguiente salto.",
    ],
    mistakes: [
      "Elegir una altura o distancia que no puedes controlar.",
      "Aterrizar rígido o con las rodillas hacia dentro.",
      "Rebotar de inmediato cuando ya no puedes amortiguar bien.",
    ],
    progressions: [
      "Aumenta altura, distancia o densidad de trabajo de forma gradual.",
      "Mantén primero aterrizajes silenciosos y estables en cada repetición.",
    ],
    regressions: [
      "Reduce altura o distancia y practica saltos individuales.",
      "Cambia a una subida al cajón o a un paso controlado.",
    ],
  },
  Metabólico: {
    description:
      "Movimiento cíclico habitual en WODs que combina coordinación y capacidad de trabajo. Mantén un ritmo sostenible y repeticiones de calidad.",
    technique: [
      "Organiza la posición inicial para repetir el mismo patrón con eficiencia.",
      "Coordina respiración y movimiento sin perder postura.",
      "Regula el ritmo para sostener la técnica durante toda la serie.",
    ],
    mistakes: [
      "Empezar a una intensidad que obliga a parar pronto.",
      "Perder postura al acelerar las repeticiones.",
      "Descuidar el control del implemento o del entorno.",
    ],
    progressions: [
      "Aumenta gradualmente las repeticiones o el tiempo de trabajo.",
      "Mejora el ritmo manteniendo la misma calidad en cada repetición.",
    ],
    regressions: [
      "Reduce las repeticiones, la carga o la altura del objetivo.",
      "Divide la serie en bloques con descansos breves planificados.",
    ],
  },
  Acondicionamiento: {
    description:
      "Trabajo de transporte o tracción que desarrolla acondicionamiento, estabilidad y capacidad de mantener una carga en movimiento.",
    technique: [
      "Asegura el agarre y una postura erguida antes de desplazarte.",
      "Da pasos cortos y controlados con el tronco estable.",
      "Deja la carga en el suelo con control antes de soltarla.",
    ],
    mistakes: [
      "Inclinarse o rotar el tronco bajo carga.",
      "Usar una carga que compromete el agarre o el paso.",
      "Soltar el implemento de forma brusca.",
    ],
    progressions: [
      "Aumenta distancia o carga gradualmente, cambiando una variable cada vez.",
      "Mantén el mismo control al avanzar a cargas mayores.",
    ],
    regressions: [
      "Reduce carga y distancia, o realiza el recorrido sin implemento.",
      "Usa intervalos cortos para recuperar el agarre y la postura.",
    ],
  },
  Cardio: {
    description:
      "Trabajo cardiovascular cíclico que permite desarrollar resistencia y regular el esfuerzo a lo largo del tiempo o la distancia.",
    technique: [
      "Adopta una posición cómoda y eficiente para el equipo o terreno.",
      "Mantén una cadencia regular y respira de forma continua.",
      "Ajusta el esfuerzo para poder sostenerlo durante el intervalo previsto.",
    ],
    mistakes: [
      "Salir demasiado rápido y perder el ritmo.",
      "Forzar una postura incómoda o una cadencia irregular.",
      "Ignorar la técnica cuando aparece la fatiga.",
    ],
    progressions: [
      "Aumenta duración o distancia poco a poco manteniendo una cadencia estable.",
      "Introduce intervalos algo más intensos después de consolidar la base.",
    ],
    regressions: [
      "Reduce duración e intensidad o intercala pausas de recuperación.",
      "Elige una modalidad de bajo impacto si lo necesitas.",
    ],
  },
};

export const movements: Movement[] = seeds.map(
  (
    [
      name,
      nameEs,
      aliases,
      equipment,
      category,
      level = ["Halterofilia", "Gimnásticos"].includes(category) ? "Intermediate" : "Beginner",
      rm = ["Barra", "Mancuernas", "Kettlebell"].some((x) => equipment.includes(x)) &&
        ["Fuerza", "Halterofilia"].includes(category),
    ],
    index,
  ) => ({
    id: `move-${String(index + 1).padStart(3, "0")}`,
    name,
    nameEs,
    aliases: [
      ...new Set(
        aliases
          .split("|")
          .map((alias) => alias.trim())
          .filter(Boolean),
      ),
    ],
    category,
    equipment: equipment.split(" o "),
    level,
    rm,
    description: `${name}: ${categoryCues[category].description} Equipamiento habitual: ${equipment.toLowerCase()}.`,
    technique: categoryCues[category].technique,
    commonMistakes: categoryCues[category].mistakes,
    progressions: categoryCues[category].progressions,
    regressions: categoryCues[category].regressions,
    muscles: categoryMuscles[category] ?? ["Piernas", "Core"],
    videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} CrossFit movement demo`)}`,
  }),
);

export const MOVEMENT_CATEGORIES = [...new Set(movements.map((m) => m.category))].sort();
export const MOVEMENT_EQUIPMENT = [...new Set(movements.flatMap((m) => m.equipment))].sort();
