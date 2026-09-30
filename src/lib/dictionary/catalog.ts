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
    "bar muscleup|bmu",
    "Barra de dominadas",
    "Gimnásticos",
    "Advanced",
  ],
  [
    "Ring Muscle-Up",
    "Muscle-up en anillas",
    "ring muscleup|rmu",
    "Anillas",
    "Gimnásticos",
    "Advanced",
  ],
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
  ["Lunges", "Zancadas", "lunge", "Peso corporal o carga", "Fuerza"],
  ["Box Step-Up", "Subida al cajón", "step up", "Cajón", "Pliometría"],
  ["Box Jump", "Salto al cajón", "box jump", "Cajón", "Pliometría"],
  ["Box Jump Over", "Salto por encima del cajón", "box over", "Cajón", "Pliometría"],
  ["Broad Jump", "Salto horizontal", "broad jump", "Suelo", "Pliometría"],
  ["Burpee", "Burpee", "burpee", "Suelo", "Metabólico"],
  ["Burpee Box Jump Over", "Burpee y salto sobre cajón", "bbjo", "Cajón", "Metabólico"],
  [
    "Wall Ball",
    "Lanzamiento de balón a pared",
    "wallball|wall ball shot|wallball shot",
    "Balón medicinal y pared",
    "Metabólico",
  ],
  ["Kettlebell Swing", "Balanceo de kettlebell", "kb swing", "Kettlebell", "Metabólico"],
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
  ["Assault Bike", "Bicicleta de aire", "air bike|echo bike", "Bicicleta de aire", "Cardio"],
  ["Running", "Carrera", "run|correr", "Ninguno", "Cardio"],
  ["Swimming", "Natación", "swim|nadar", "Piscina", "Cardio"],
  // Phase 3A additions. Keep these appended so existing movement IDs remain stable.
  ["Air Squat", "Sentadilla al aire", "bodyweight squat|air squat", "Peso corporal", "Fuerza"],
  ["Box Squat", "Sentadilla a cajón", "box squat", "Barra y cajón", "Fuerza"],
  ["Split Squat", "Sentadilla dividida", "split squat", "Peso corporal o mancuernas", "Fuerza"],
  [
    "Walking Lunge",
    "Zancada caminando",
    "walking lunge|walking lunges",
    "Peso corporal o carga",
    "Fuerza",
  ],
  ["Reverse Lunge", "Zancada hacia atrás", "reverse lunge", "Peso corporal o carga", "Fuerza"],
  ["Forward Lunge", "Zancada hacia delante", "forward lunge", "Peso corporal o carga", "Fuerza"],
  ["Lateral Lunge", "Zancada lateral", "lateral lunge", "Peso corporal o carga", "Fuerza"],
  ["Cossack Squat", "Sentadilla cosaca", "cossack squat", "Peso corporal o carga", "Fuerza"],
  ["Weighted Step-Up", "Subida al cajón con carga", "weighted step up", "Cajón y carga", "Fuerza"],
  [
    "Stiff-Leg Deadlift",
    "Peso muerto con piernas rígidas",
    "stiff leg deadlift|sldl",
    "Barra",
    "Fuerza",
  ],
  [
    "Single-Leg Romanian Deadlift",
    "Peso muerto rumano a una pierna",
    "single leg rdl|single-leg rdl",
    "Mancuerna o kettlebell",
    "Fuerza",
    "Intermediate",
  ],
  [
    "Deficit Deadlift",
    "Peso muerto desde déficit",
    "deficit deadlift",
    "Barra y plataforma",
    "Fuerza",
    "Advanced",
  ],
  [
    "Snatch-Grip Deadlift",
    "Peso muerto con agarre de arrancada",
    "snatch grip deadlift",
    "Barra",
    "Fuerza",
  ],
  [
    "Clean-Grip Deadlift",
    "Peso muerto con agarre de cargada",
    "clean grip deadlift",
    "Barra",
    "Fuerza",
  ],
  [
    "Jefferson Deadlift",
    "Peso muerto Jefferson",
    "jefferson deadlift",
    "Barra",
    "Fuerza",
    "Intermediate",
  ],
  ["Good Morning", "Buenos días", "good morning", "Barra", "Fuerza"],
  ["Hip Thrust", "Empuje de cadera", "hip thrust|barbell hip thrust", "Barra y banco", "Fuerza"],
  ["Glute Bridge", "Puente de glúteos", "glute bridge", "Suelo o barra", "Fuerza"],
  ["Kettlebell Deadlift", "Peso muerto con kettlebell", "kb deadlift", "Kettlebell", "Fuerza"],
  ["Dumbbell Deadlift", "Peso muerto con mancuernas", "db deadlift", "Mancuernas", "Fuerza"],
  [
    "Hang Power Clean",
    "Cargada de potencia desde hang",
    "hang power clean|hpc",
    "Barra",
    "Halterofilia",
    "Intermediate",
  ],
  ["Muscle Clean", "Cargada muscular", "muscle clean", "Barra", "Halterofilia", "Advanced"],
  ["Clean Pull", "Tirón de cargada", "clean pull", "Barra", "Halterofilia"],
  ["Clean High Pull", "Tirón alto de cargada", "clean high pull", "Barra", "Halterofilia"],
  [
    "Hang Power Snatch",
    "Arrancada de potencia desde hang",
    "hang power snatch|hps",
    "Barra",
    "Halterofilia",
    "Intermediate",
  ],
  ["Muscle Snatch", "Arrancada muscular", "muscle snatch", "Barra", "Halterofilia", "Advanced"],
  ["Snatch Pull", "Tirón de arrancada", "snatch pull", "Barra", "Halterofilia"],
  ["Snatch High Pull", "Tirón alto de arrancada", "snatch high pull", "Barra", "Halterofilia"],
  ["Power Jerk", "Jerk de potencia", "power jerk", "Barra", "Halterofilia", "Advanced"],
  ["Jerk Balance", "Equilibrio de jerk", "jerk balance", "Barra", "Halterofilia", "Advanced"],
  ["Incline Bench Press", "Press inclinado", "incline bench", "Barra y banco inclinado", "Fuerza"],
  [
    "Dumbbell Bench Press",
    "Press de banca con mancuernas",
    "db bench press",
    "Mancuernas y banco",
    "Fuerza",
  ],
  [
    "Dumbbell Shoulder Press",
    "Press de hombros con mancuernas",
    "db shoulder press",
    "Mancuernas",
    "Fuerza",
  ],
  ["Arnold Press", "Press Arnold", "arnold press", "Mancuernas", "Fuerza"],
  ["Floor Press", "Press desde el suelo", "floor press", "Barra o mancuernas", "Fuerza"],
  ["Z-Press", "Press Z", "z press", "Barra o mancuernas", "Fuerza", "Advanced"],
  [
    "Deficit Handstand Push-Up",
    "Flexión de pino con déficit",
    "deficit hspu",
    "Pared y paralelas",
    "Gimnásticos",
    "Advanced",
  ],
  ["Pike Push-Up", "Flexión en pica", "pike push up", "Suelo o cajón", "Gimnásticos"],
  ["Push-Up", "Flexión", "push up|press up", "Suelo", "Gimnásticos"],
  [
    "Hand-Release Push-Up",
    "Flexión con despegue de manos",
    "hand release push up|hrpu",
    "Suelo",
    "Gimnásticos",
  ],
  ["Ring Push-Up", "Flexión en anillas", "ring push up", "Anillas", "Gimnásticos", "Intermediate"],
  ["Barbell Row", "Remo con barra", "barbell row", "Barra", "Fuerza"],
  ["Pendlay Row", "Remo Pendlay", "pendlay row", "Barra", "Fuerza", "Intermediate"],
  [
    "Dumbbell Row",
    "Remo con mancuerna",
    "db row|one arm dumbbell row",
    "Mancuerna y banco",
    "Fuerza",
  ],
  [
    "Strict Pull-Up",
    "Dominada estricta",
    "strict pull up|strict pullup",
    "Barra de dominadas",
    "Gimnásticos",
    "Intermediate",
  ],
  [
    "Strict Chest-to-Bar",
    "Dominada estricta al pecho",
    "strict c2b|strict chest to bar",
    "Barra de dominadas",
    "Gimnásticos",
    "Advanced",
  ],
  [
    "Kipping Pull-Up",
    "Dominada con kipping",
    "kipping pull up|kipping pullup",
    "Barra de dominadas",
    "Gimnásticos",
    "Intermediate",
  ],
  [
    "Butterfly Pull-Up",
    "Dominada butterfly",
    "butterfly pull up|butterfly pullup",
    "Barra de dominadas",
    "Gimnásticos",
    "Advanced",
  ],
  [
    "Hanging Knee Raise",
    "Elevación de rodillas colgado",
    "hanging knee raise|hkr",
    "Barra de dominadas",
    "Gimnásticos",
  ],
  [
    "Strict Muscle-Up",
    "Muscle-up estricto",
    "strict muscle up",
    "Anillas",
    "Gimnásticos",
    "Advanced",
  ],
  ["L-Sit", "L-sit", "l sit|lsit", "Paralelas o anillas", "Gimnásticos", "Intermediate"],
  [
    "Freestanding Handstand",
    "Pino libre",
    "freestanding handstand|free standing handstand",
    "Suelo",
    "Gimnásticos",
    "Advanced",
  ],
  ["Wall Walk", "Caminata por pared", "wall walk", "Pared", "Gimnásticos", "Intermediate"],
  [
    "Handstand Shoulder Tap",
    "Toque de hombro en pino",
    "handstand shoulder tap",
    "Pared",
    "Gimnásticos",
    "Advanced",
  ],
  ["AbMat Sit-Up", "Abdominal con AbMat", "abmat sit up|ab mat situp", "AbMat", "Gimnásticos"],
  ["V-Up", "V-up", "v up|v-up", "Suelo", "Gimnásticos"],
  ["Plank", "Plancha", "plank hold", "Suelo", "Gimnásticos"],
  ["Side Plank", "Plancha lateral", "side plank hold", "Suelo", "Gimnásticos"],
  ["Russian Twist", "Giro ruso", "russian twist", "Suelo o carga", "Gimnásticos"],
  [
    "American Kettlebell Swing",
    "Balanceo americano de kettlebell",
    "american kb swing|american swing",
    "Kettlebell",
    "Metabólico",
  ],
  ["Kettlebell Clean", "Cargada con kettlebell", "kb clean", "Kettlebell", "Halterofilia"],
  [
    "Kettlebell Snatch",
    "Arrancada con kettlebell",
    "kb snatch",
    "Kettlebell",
    "Halterofilia",
    "Intermediate",
  ],
  [
    "Kettlebell Press",
    "Press con kettlebell",
    "kb press|kettlebell strict press",
    "Kettlebell",
    "Fuerza",
  ],
  ["Kettlebell Push Press", "Push press con kettlebell", "kb push press", "Kettlebell", "Fuerza"],
  [
    "Kettlebell Push Jerk",
    "Push jerk con kettlebell",
    "kb push jerk",
    "Kettlebell",
    "Halterofilia",
    "Intermediate",
  ],
  [
    "Kettlebell Goblet Squat",
    "Sentadilla goblet con kettlebell",
    "kb goblet squat",
    "Kettlebell",
    "Fuerza",
  ],
  [
    "Kettlebell Front Rack Squat",
    "Sentadilla front rack con kettlebell",
    "kb front rack squat",
    "Kettlebell",
    "Fuerza",
  ],
  [
    "Dumbbell Hang Clean",
    "Cargada colgante con mancuernas",
    "db hang clean",
    "Mancuernas",
    "Halterofilia",
  ],
  [
    "Dumbbell Hang Snatch",
    "Arrancada colgante con mancuerna",
    "db hang snatch",
    "Mancuerna",
    "Halterofilia",
  ],
  ["Dumbbell Push Press", "Push press con mancuernas", "db push press", "Mancuernas", "Fuerza"],
  [
    "Dumbbell Push Jerk",
    "Push jerk con mancuernas",
    "db push jerk",
    "Mancuernas",
    "Halterofilia",
    "Intermediate",
  ],
  ["Dumbbell Thruster", "Thruster con mancuernas", "db thruster", "Mancuernas", "Metabólico"],
  [
    "Dumbbell Walking Lunge",
    "Zancada caminando con mancuernas",
    "db walking lunge|dumbbell walking lunges",
    "Mancuernas",
    "Fuerza",
  ],
  [
    "Dumbbell Step-Up",
    "Subida al cajón con mancuernas",
    "db step up",
    "Cajón y mancuernas",
    "Fuerza",
  ],
  ["Barbell Lunge", "Zancada con barra", "barbell lunge", "Barra", "Fuerza"],
  [
    "Barbell Step-Up",
    "Subida al cajón con barra",
    "barbell step up",
    "Cajón y barra",
    "Fuerza",
    "Intermediate",
  ],
  ["Zercher Squat", "Sentadilla Zercher", "zercher squat", "Barra", "Fuerza", "Intermediate"],
  ["Zercher Carry", "Porteo Zercher", "zercher carry", "Barra o sandbag", "Acondicionamiento"],
  [
    "Suitcase Carry",
    "Porteo unilateral",
    "suitcase carry",
    "Kettlebell o mancuerna",
    "Acondicionamiento",
  ],
  [
    "Waiter's Carry",
    "Porteo de camarero",
    "waiters carry|waiter's carry",
    "Kettlebell o mancuerna",
    "Acondicionamiento",
  ],
  ["Squat Jump", "Salto desde sentadilla", "squat jump", "Suelo", "Pliometría"],
  ["Lateral Burpee", "Burpee lateral", "lateral burpee", "Suelo", "Metabólico"],
  [
    "Bar-Facing Burpee",
    "Burpee frente a barra",
    "bar facing burpee|bar-facing burpee",
    "Suelo y barra",
    "Metabólico",
  ],
  [
    "Burpee Pull-Up",
    "Burpee con dominada",
    "burpee pull up",
    "Barra de dominadas",
    "Metabólico",
    "Intermediate",
  ],
  ["Triple Under", "Triple salto de comba", "tu|triple unders", "Comba", "Metabólico", "Advanced"],
  [
    "Med Ball Clean",
    "Cargada con balón medicinal",
    "medicine ball clean|medball clean",
    "Balón medicinal",
    "Halterofilia",
  ],
  [
    "Med Ball Slam",
    "Lanzamiento de balón medicinal al suelo",
    "medicine ball slam|medball slam",
    "Balón medicinal",
    "Metabólico",
  ],
  [
    "Med Ball Sit-Up",
    "Abdominal con balón medicinal",
    "medicine ball sit up",
    "Balón medicinal",
    "Gimnásticos",
  ],
  [
    "Med Ball Front Carry",
    "Porteo frontal de balón medicinal",
    "medicine ball front carry",
    "Balón medicinal",
    "Acondicionamiento",
  ],
  ["Sprint", "Esprint", "sprint|sprinting", "Ninguno", "Cardio"],
  [
    "Backward Sled Drag",
    "Arrastre de trineo hacia atrás",
    "backward sled drag|reverse sled drag",
    "Trineo",
    "Acondicionamiento",
  ],
  ["Sled Drag", "Desplazamiento de trineo arrastrado", "sled drag", "Trineo", "Acondicionamiento"],
  ["Sandbag Carry", "Porteo de sandbag", "sandbag carry", "Sandbag", "Acondicionamiento"],
  [
    "Sandbag Bear Hug Carry",
    "Porteo de sandbag en abrazo",
    "sandbag bear hug carry",
    "Sandbag",
    "Acondicionamiento",
  ],
  [
    "Sandbag Shouldering",
    "Carga de sandbag al hombro",
    "sandbag shouldering|sandbag to shoulder",
    "Sandbag",
    "Fuerza",
  ],
  ["Sandbag Clean", "Cargada con sandbag", "sandbag clean", "Sandbag", "Fuerza"],
  ["Sandbag Squat", "Sentadilla con sandbag", "sandbag squat", "Sandbag", "Fuerza"],
  ["Sandbag Lunge", "Zancada con sandbag", "sandbag lunge", "Sandbag", "Fuerza"],
  ["Dead Hang", "Suspensión pasiva", "dead hang|passive hang", "Barra de dominadas", "Gimnásticos"],
  ["Active Hang", "Suspensión activa", "active hang", "Barra de dominadas", "Gimnásticos"],
  [
    "Scapular Pull-Up",
    "Dominada escapular",
    "scap pull up|scapular pullup",
    "Barra de dominadas",
    "Gimnásticos",
  ],
  [
    "Towel Hang",
    "Suspensión con toalla",
    "towel hang",
    "Barra y toalla",
    "Gimnásticos",
    "Intermediate",
  ],
  [
    "Farmer Hold",
    "Agarre estático del granjero",
    "farmer hold",
    "Mancuernas o kettlebells",
    "Acondicionamiento",
  ],
  ["Plate Pinch", "Pinza de discos", "plate pinch hold", "Discos", "Acondicionamiento"],
  ["Man Maker", "Man maker", "manmaker", "Mancuernas", "Metabólico", "Advanced"],
  [
    "Dumbbell Man Maker",
    "Man maker con mancuernas",
    "db man maker|dumbbell manmaker",
    "Mancuernas",
    "Metabólico",
    "Advanced",
  ],
  ["Renegade Row", "Remo renegado", "renegade row", "Mancuernas", "Fuerza", "Intermediate"],
  ["Bear Crawl", "Gateo de oso", "bear crawl", "Suelo", "Acondicionamiento"],
];

// RM is reserved for stable, loadable strength/Olympic lifts, not every movement
// that happens to use a barbell or dumbbell.
const rmMovements = new Set([
  "Back Squat",
  "Front Squat",
  "Overhead Squat",
  "Deadlift",
  "Sumo Deadlift",
  "Clean",
  "Power Clean",
  "Squat Clean",
  "Snatch",
  "Power Snatch",
  "Squat Snatch",
  "Clean & Jerk",
  "Split Jerk",
  "Push Jerk",
  "Strict Press",
  "Push Press",
  "Bench Press",
]);

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

type MovementGuidance = Pick<
  Movement,
  "description" | "technique" | "commonMistakes" | "progressions" | "regressions" | "muscles"
>;

/** Movement-family coaching notes used for the new entries; variations add their own focus. */
function movementGuidance(name: string, fallbackCategory: string): MovementGuidance {
  const lower = name.toLowerCase();
  let description: string;
  let technique: string[];
  let commonMistakes: string[];
  let progressions: string[];
  let regressions: string[];
  let muscles: string[];

  if (lower.includes("clean & jerk") || lower.includes("clean jerk")) {
    description = `${name} combina la recepción de clean en front rack con un jerk que fija la barra sobre la cabeza. Ambas fases deben enlazarse sin perder equilibrio.`;
    technique = [
      "Completa el clean y estabiliza el front rack antes de iniciar el jerk.",
      "Haz un dip vertical corto con tronco erguido.",
      "Impulsa y recibe la barra con codos bloqueados; recupera los pies de forma controlada.",
    ];
    commonMistakes = [
      "Iniciar el jerk antes de estabilizar la recepción del clean.",
      "Inclinar el torso en el dip o enviar la barra hacia delante.",
      "Dejar los codos blandos o recuperar los pies sin control.",
    ];
    progressions = [
      "Practica clean y jerk por separado con cargas ligeras.",
      "Enlaza ambas fases con pausa en front rack antes de aumentar carga.",
    ];
    regressions = [
      "Reduce carga y usa un clean desde hang.",
      "Practica el dip-drive y el bloqueo overhead por separado.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Hombros", "Tríceps", "Core"];
  } else if (/clean (pull|high pull)|snatch (pull|high pull)/.test(lower)) {
    const snatch = lower.startsWith("snatch");
    description = `${name} practica la extensión potente y el tirón de ${snatch ? "la arrancada" : "la cargada"}, sin recepción. ${lower.includes("high") ? "Los codos guían la barra arriba después de completar la extensión." : "La barra permanece próxima al cuerpo durante el recorrido."}`;
    technique = [
      "Inicia desde la posición de tirón correspondiente con la espalda firme.",
      "Empuja el suelo y extiende cadera y rodillas antes de flexionar brazos.",
      "Mantén la barra próxima; en el high pull guía codos arriba y afuera tras extenderte.",
    ];
    commonMistakes = [
      "Tirar con los brazos antes de extender cadera y rodillas.",
      "Alejar la barra del cuerpo.",
      "Convertir el tirón en una recepción o en un remo temprano.",
    ];
    progressions = [
      "Practica el tirón desde posiciones parciales con carga ligera.",
      "Añade carga cuando mantengas el orden extensión-tirón.",
    ];
    regressions = [
      "Ensaya el recorrido con PVC.",
      "Reduce carga y detén el tirón antes de perder proximidad.",
    ];
    muscles = ["Glúteos", "Isquiotibiales", "Cuádriceps", "Trapecios", "Espalda"];
  } else if (lower.includes("clean") && /sandbag|med ball/.test(lower)) {
    const implement = lower.includes("sandbag") ? "el sandbag" : "el balón medicinal";
    description = `${name} levanta ${implement} desde el suelo hasta el pecho mediante extensión de piernas y cadera. Su forma voluminosa requiere abrazar la carga cerca del cuerpo durante la recepción.`;
    technique = [
      "Coloca los pies junto al implemento y flexiona cadera y rodillas para abrazarlo.",
      "Mantén la espalda firme y la carga pegada al tronco.",
      "Extiende piernas y cadera y recibe el implemento en posición frontal estable.",
    ];
    commonMistakes = [
      "Alejar el implemento del cuerpo al despegar.",
      "Tirar solo con brazos o redondear la espalda.",
      "Recibir con pies inestables o soltar la carga contra el pecho.",
    ];
    progressions = [
      "Practica el abrazo y el levantamiento desde una altura elevada.",
      "Aumenta carga cuando puedas mantenerla cerca durante todo el tirón.",
    ];
    regressions = [
      "Usa un balón ligero o una bolsa menos cargada.",
      "Practica bisagra y abrazo estático antes del clean completo.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Espalda alta", "Core", "Agarre"];
  } else if (lower.includes("clean")) {
    const fromHang = lower.includes("hang");
    const power = lower.includes("power");
    const dumbbell = lower.includes("dumbbell");
    const kettlebell = lower.includes("kettlebell");
    const sandbag = lower.includes("sandbag");
    const implement = dumbbell
      ? "las mancuernas"
      : kettlebell
        ? "la kettlebell"
        : sandbag
          ? "el sandbag"
          : "la barra";
    description = `${name} entrena la recepción de ${implement} en los hombros desde ${fromHang ? "una posición colgante" : "el suelo"}. ${power ? "La recepción de potencia queda por encima del paralelo." : "La recepción completa se estabiliza en sentadilla frontal profunda antes de levantarse."}`;
    technique = [
      fromHang
        ? `Inicia con ${implement} junto al muslo y el peso equilibrado en el pie.`
        : `Coloca ${implement} cerca del mediopié, con hombros ligeramente delante y espalda firme.`,
      `Extiende cadera y rodillas antes de guiar ${implement} cerca del torso.`,
      power
        ? `Recibe ${implement} con cadera por encima de las rodillas y codos rápidos.`
        : dumbbell
          ? "Gira cada mancuerna hacia el hombro y estabiliza ambos lados sin colapsar muñecas."
          : kettlebell
            ? "Rodea la kettlebell con la mano y recibe en rack sin golpear el antebrazo."
            : "Gira los codos alrededor de la carga y estabiliza el rack frontal.",
    ];
    commonMistakes = [
      "Separar la barra del cuerpo al acelerar.",
      "Tirar con los brazos antes de completar la extensión.",
      "Recibir con codos bajos o perder el equilibrio hacia delante.",
    ];
    progressions = [
      "Practica el tirón desde posiciones parciales con barra ligera.",
      "Añade carga en incrementos pequeños cuando la recepción sea consistente.",
    ];
    regressions = [
      "Usa PVC o una barra ligera y elimina la recepción dinámica.",
      "Practica el front rack y la sentadilla frontal por separado.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Trapecios", "Core"];
  } else if (lower.includes("snatch")) {
    const fromHang = lower.includes("hang");
    const power = lower.includes("power");
    const dumbbell = lower.includes("dumbbell");
    const kettlebell = lower.includes("kettlebell");
    const implement = dumbbell ? "la mancuerna" : kettlebell ? "la kettlebell" : "la barra";
    description = `${name} desplaza ${implement} desde ${fromHang ? "el muslo" : "el suelo"} hasta una recepción estable sobre la cabeza. ${power ? "La recepción queda por encima del paralelo." : "La recepción completa se fija en sentadilla overhead profunda con hombros activos."}`;
    technique = [
      fromHang
        ? `Empieza con ${implement} en el muslo y el tronco firme.`
        : `Alinea ${implement} junto al mediopié y conserva la espalda firme.`,
      `Extiende cadera y rodillas manteniendo ${implement} cerca del cuerpo.`,
      power
        ? "Recibe con brazos bloqueados en una posición parcial estable."
        : dumbbell
          ? "Pasa bajo la mancuerna y fija el codo con hombro activo antes de levantarte."
          : kettlebell
            ? "Rota la mano alrededor de la kettlebell y fija el codo sin golpear el antebrazo."
            : "Pasa rápido bajo la barra y fija los brazos con hombros activos.",
      "Levántate manteniendo la carga alineada sobre el mediopié.",
    ];
    commonMistakes = [
      "Dejar que la barra se aleje del cuerpo.",
      "Recibir con codos flexionados o sin control escapular.",
      "Perder el equilibrio hacia delante en la recepción.",
    ];
    progressions = [
      "Trabaja el tirón y la recepción por separado con PVC.",
      "Aumenta la carga solo tras repetir recepciones estables.",
    ];
    regressions = [
      "Reduce la carga y practica desde hang para acortar el recorrido.",
      "Usa una sentadilla overhead estática con apoyo antes de recibir en movimiento.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Espalda alta", "Hombros", "Core"];
  } else if (lower.includes("jerk")) {
    description = `${name} impulsa la barra desde los hombros y la fija sobre la cabeza con una base estable. La variante determina si la recepción es en split o con los pies paralelos.`;
    technique = [
      "Apoya la barra en el front rack y mantén el torso vertical.",
      "Flexiona rodillas en línea con los pies sin inclinar el tronco.",
      "Impulsa verticalmente y desplázate bajo la barra.",
      "Bloquea codos, estabiliza la recepción y recupera los pies con control.",
    ];
    commonMistakes = [
      "Convertir la flexión en una sentadilla profunda.",
      "Empujar la barra hacia delante en vez de bajo ella.",
      "Recibir con brazos blandos o pies desalineados.",
    ];
    progressions = [
      "Practica el dip-drive sin carga y luego con barra ligera.",
      "Añade pausas en la recepción para consolidar estabilidad.",
    ];
    regressions = [
      "Reduce carga y rango del dip.",
      "Practica el bloqueo overhead y el paso de pies por separado.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Hombros", "Tríceps", "Core"];
  } else if (/thruster/.test(lower)) {
    description = `${name} enlaza una sentadilla frontal con un empuje vertical en una repetición. El ascenso de piernas transmite fuerza al press sin perder la línea del tronco.`;
    technique = [
      "Sostén la carga en front rack y estabiliza los pies.",
      "Desciende en sentadilla con talones apoyados y torso firme.",
      "Impulsa desde las piernas y termina el press con brazos bloqueados sobre la cabeza.",
    ];
    commonMistakes = [
      "Iniciar el press antes de extender las piernas.",
      "Dejar caer codos y carga al salir de la sentadilla.",
      "Arquear la espalda al fijar la carga overhead.",
    ];
    progressions = [
      "Practica front squat y press por separado antes de enlazarlos.",
      "Sube carga o repeticiones de forma gradual.",
    ];
    regressions = [
      "Reduce carga o limita la profundidad a un rango controlado.",
      "Usa sentadilla goblet seguida de press ligero.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Hombros", "Tríceps", "Core"];
  } else if (/squat/.test(lower) && !lower.includes("jump")) {
    const overhead = lower.includes("overhead");
    const backSquat = lower === "back squat";
    const box = lower.includes("box");
    const unilateral =
      lower.includes("split") || lower.includes("pistol") || lower.includes("cossack");
    description = `${name} desarrolla fuerza de piernas mediante flexión coordinada de cadera y rodilla. ${backSquat ? "Apoya la barra de forma estable sobre la espalda alta y mantén su trayectoria sobre el mediopié." : overhead ? "La carga permanece bloqueada sobre la cabeza durante todo el recorrido." : box ? "El cajón marca una profundidad repetible; tócala sin dejar caer el peso sobre él." : unilateral ? "La base asimétrica exige controlar la pelvis y la rodilla de la pierna de apoyo." : "Mantén el apoyo del pie completo y la carga equilibrada sobre la base."}`;
    technique = [
      backSquat
        ? "Ajusta la barra sobre trapecios o deltoides posteriores, junta escápulas y fija el tronco antes de sacarla del rack."
        : "Coloca los pies en una anchura que permita mantener talón y antepié apoyados.",
      "Inicia llevando cadera y rodillas juntas, con el tronco firme.",
      box
        ? "Desciende hasta tocar el cajón con control, sin relajarte ni balancearte."
        : "Desciende hasta la profundidad que permita conservar la columna y el equilibrio.",
      backSquat
        ? "Mantén la barra sobre el mediopié y sube empujando el suelo, con rodillas alineadas y tronco rígido."
        : overhead
          ? "Mantén brazos bloqueados y la carga sobre el mediopié."
          : "Sube empujando el suelo y manteniendo rodillas alineadas con los pies.",
    ];
    commonMistakes = [
      "Levantar talones o colapsar el arco del pie.",
      "Dejar que las rodillas caigan hacia dentro.",
      box
        ? "Sentarse y perder tensión sobre el cajón."
        : "Perder la posición lumbar al ganar profundidad.",
    ];
    progressions = [
      "Mejora primero profundidad y control con peso corporal.",
      "Añade carga manteniendo el mismo recorrido y ritmo.",
    ];
    regressions = [
      "Reduce profundidad o usa un cajón alto como referencia.",
      "Practica sentadilla asistida sujetándote a un apoyo estable.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Aductores", "Core"];
  } else if (/lunge/.test(lower)) {
    const walking = lower.includes("walking");
    const direction = lower.includes("reverse")
      ? "El paso atrás reduce el desplazamiento anterior de la rodilla adelantada."
      : lower.includes("forward")
        ? "El paso al frente exige frenar el avance antes de empujar de vuelta."
        : lower.includes("lateral")
          ? "El paso lateral carga la cadera mientras la otra pierna permanece extendida."
          : walking
            ? "Cada repetición transfiere el peso a la pierna adelantada para avanzar."
            : "La zancada fija permite controlar ambas piernas en el mismo sitio.";
    description = `${name} entrena fuerza unilateral con una zancada controlada. ${direction}`;
    technique = [
      lower.includes("reverse")
        ? "Da el paso hacia atrás y conserva el peso centrado sobre el pie delantero."
        : lower.includes("lateral")
          ? "Lleva la cadera atrás hacia el lado que flexiona y mantén el otro pie apoyado."
          : "Mantén pelvis nivelada y tronco estable antes de dar el paso.",
      "Apoya el pie completo y deja que ambas rodillas flexionen sin colapsar hacia dentro.",
      "Desciende hasta una profundidad controlada sin golpear la rodilla trasera.",
      walking
        ? "Impulsa desde el pie adelantado y enlaza el siguiente paso sin perder equilibrio."
        : "Empuja el suelo para volver a la posición inicial.",
    ];
    commonMistakes = [
      "Dar un paso tan corto que la rodilla se desplaza sin control.",
      "Inclinar o rotar el tronco bajo carga.",
      "Impulsarse principalmente con la pierna trasera.",
    ];
    progressions = [
      "Aumenta primero el rango y la estabilidad sin carga.",
      "Añade carga en posición goblet antes de usar barra.",
    ];
    regressions = [
      "Usa zancada estática con apoyo de una mano.",
      "Reduce profundidad y distancia del paso.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Aductores", "Core"];
  } else if (/back extension|hip extension/.test(lower)) {
    description = `${name} fortalece la extensión de cadera y tronco desde un apoyo de GHD o banco. El movimiento termina al alinear el cuerpo, no al arquear la espalda.`;
    technique = [
      "Ajusta el apoyo para que la cadera pueda flexionarse libremente.",
      "Desciende desde la cadera manteniendo el tronco firme.",
      "Extiende cadera y tronco hasta quedar alineado y vuelve con control.",
    ];
    commonMistakes = [
      "Hiperextender la zona lumbar al subir.",
      "Flexionar y extender solo la espalda en vez de mover la cadera.",
      "Usar rebote o un rango que no puedes controlar.",
    ];
    progressions = [
      "Aumenta el rango sin carga antes de añadir peso.",
      "Sujeta una carga ligera al pecho tras dominar el recorrido.",
    ];
    regressions = [
      "Reduce el rango y usa las manos como apoyo.",
      "Practica bisagra de cadera de pie sin carga.",
    ];
    muscles = ["Erectores espinales", "Glúteos", "Isquiotibiales", "Core"];
  } else if (/turkish get-up/.test(lower)) {
    description = `${name} enlaza varias posiciones desde el suelo hasta ponerse de pie con una carga estable sobre la cabeza. Cada transición requiere control antes de avanzar.`;
    technique = [
      "Mantén la carga bloqueada sobre el hombro y la mirada en ella.",
      "Pasa de tumbado a apoyo en mano y cadera sin perder alineación.",
      "Recoge la pierna bajo el cuerpo, ponte de pie y deshaz la secuencia en orden.",
    ];
    commonMistakes = [
      "Perder de vista o dejar que la carga se desplace sobre la cara.",
      "Apresurar las transiciones y apoyar la mano en una posición inestable.",
      "Flexionar la muñeca o el codo durante el levantamiento.",
    ];
    progressions = [
      "Practica cada transición sin carga y con pausas.",
      "Añade una carga ligera solo cuando controles ambas direcciones.",
    ];
    regressions = [
      "Usa zapato sobre el puño para practicar el equilibrio.",
      "Limita la repetición a las primeras transiciones desde el suelo.",
    ];
    muscles = ["Hombros", "Core", "Glúteos", "Cuádriceps", "Estabilizadores escapulares"];
  } else if (/deadlift|good morning|romanian|hip thrust|glute bridge/.test(lower)) {
    const bridge = /hip thrust|glute bridge/.test(lower);
    description = `${name} carga la cadena posterior mediante extensión de cadera. ${bridge ? "La pelvis se eleva desde un apoyo estable y termina sin hiperextender la zona lumbar." : "La cadera se desplaza atrás mientras la columna conserva una posición firme."}`;
    technique = bridge
      ? [
          "Apoya espalda o tronco según la variante, con pies firmes.",
          "Desciende la pelvis con control sin perder la posición de costillas.",
          "Extiende la cadera hasta alinear tronco y muslos, sin arquear la espalda.",
        ]
      : [
          "Ajusta el agarre y crea tensión antes de mover la carga.",
          "Lleva la cadera atrás y flexiona rodillas solo lo necesario para la variante.",
          "Mantén la carga cerca de las piernas y la columna estable.",
          "Extiende cadera y rodillas juntos hasta quedar erguido, sin inclinarte atrás.",
        ];
    commonMistakes = [
      "Redondear la espalda al iniciar el esfuerzo.",
      "Alejar la carga del cuerpo.",
      bridge
        ? "Terminar con hiperextensión lumbar en vez de extensión de cadera."
        : "Convertir la bisagra en una sentadilla o hiperextender al terminar.",
    ];
    progressions = [
      "Practica la bisagra con palo manteniendo tres puntos de contacto.",
      "Aumenta carga o rango gradualmente, no ambos a la vez.",
    ];
    regressions = [
      "Eleva la carga desde bloques para acortar el recorrido.",
      "Usa una bisagra sin carga o un puente de glúteos si el patrón aún no es estable.",
    ];
    muscles = ["Glúteos", "Isquiotibiales", "Erectores espinales", "Agarre", "Core"];
  } else if (/handstand push-up|pike push-up/.test(lower)) {
    description = `${name} empuja el cuerpo en posición invertida; el rango y el punto de apoyo deben permitir controlar cabeza, hombros y línea del tronco.`;
    technique = [
      "Coloca manos a una anchura cómoda y crea una base activa empujando el suelo.",
      "Desciende cabeza entre las manos con codos orientados de forma estable.",
      "Presiona el suelo y bloquea codos sin arquear la espalda.",
    ];
    commonMistakes = [
      "Abrir codos en exceso y perder la línea del hombro.",
      "Caer sobre la cabeza o rebotar sin control.",
      "Compensar el bloqueo arqueando la zona lumbar.",
    ];
    progressions = [
      "Consolida pike push-up y holds invertidos asistidos.",
      "Aumenta el rango gradualmente antes de añadir déficit.",
    ];
    regressions = [
      "Eleva las manos o reduce el rango de descenso.",
      "Usa pike push-up con pies en el suelo.",
    ];
    muscles = ["Deltoides", "Tríceps", "Trapecio", "Serrato anterior", "Core"];
  } else if (/push-up|press/.test(lower)) {
    const overhead =
      /strict press|push press|shoulder press|shoulder-to-overhead|s2oh|z-press/.test(lower);
    description = `${name} desarrolla fuerza de empuje ${overhead ? "vertical" : "horizontal"}; la estabilidad del tronco permite transmitir la fuerza sin compensar con la zona lumbar.`;
    technique = overhead
      ? [
          "Alinea muñecas bajo codos y fija abdomen y glúteos.",
          "Mantén costillas sobre pelvis y presiona la carga por una trayectoria estable.",
          "Termina con codos extendidos y carga controlada sobre la base.",
        ]
      : [
          "Coloca manos y hombros en una posición cómoda y estable.",
          "Mantén el tronco en bloque mientras flexionas los codos.",
          "Desciende con control y empuja hasta extender los codos sin perder alineación.",
        ];
    commonMistakes = [
      "Arquear la zona lumbar para completar el empuje.",
      "Perder la alineación de muñecas, codos u hombros.",
      "Acortar el recorrido al fatigarse.",
    ];
    progressions = [
      "Consolida el rango completo antes de añadir carga.",
      "Incrementa carga en pasos pequeños conservando la trayectoria.",
    ];
    regressions = [
      "Reduce carga o usa una inclinación que permita mantener el tronco.",
      "Practica un rango parcial controlado antes del recorrido completo.",
    ];
    muscles = overhead
      ? ["Deltoides", "Tríceps", "Trapecio", "Core"]
      : ["Pectorales", "Tríceps", "Deltoides anteriores", "Core"];
  } else if (/row/.test(lower) && lower !== "row") {
    const renegade = lower.includes("renegade");
    description = `${name} es un tirón horizontal dirigido hacia el torso. ${renegade ? "La posición de plancha exige evitar que la pelvis rote mientras remas cada mancuerna." : "El tronco permanece firme mientras el codo guía la carga hacia las costillas."}`;
    technique = renegade
      ? [
          "Coloca mancuernas bajo hombros y separa los pies para una base estable.",
          "Aprieta glúteos y abdomen para mantener la pelvis quieta.",
          "Rema una mancuerna hacia la cadera sin rotar el torso y alterna lados.",
        ]
      : [
          "Inclina el tronco desde la cadera y conserva la espalda neutra.",
          "Deja que el brazo se extienda sin perder control escapular.",
          "Lleva el codo hacia atrás y la carga a costillas o abdomen, según variante.",
        ];
    commonMistakes = [
      "Usar impulso del tronco para mover la carga.",
      "Encoger hombros o redondear la espalda.",
      renegade
        ? "Rotar la pelvis o dejar caer la cadera."
        : "Tirar demasiado alto y perder la trayectoria hacia el torso.",
    ];
    progressions = [
      "Aumenta el rango antes de subir carga.",
      "Añade carga manteniendo el tronco inmóvil.",
    ];
    regressions = [
      "Apoya una mano o rodilla para reducir la demanda de estabilidad.",
      "Usa una mancuerna ligera y pausa al final del tirón.",
    ];
    muscles = ["Dorsales", "Romboides", "Trapecio medio", "Bíceps", "Core"];
  } else if (/burpee pull-up/.test(lower)) {
    description = `${name} combina el burpee con una dominada sobre una barra. La transición debe dejarte debajo de la barra sin saltar a un agarre inseguro.`;
    technique = [
      "Desciende al suelo apoyando manos y pecho con control.",
      "Vuelve a los pies y salta o camina hasta un agarre firme.",
      "Completa la dominada con el rango previsto y baja con control.",
    ];
    commonMistakes = [
      "Saltar hacia una barra sin asegurar el agarre.",
      "Apresurar el burpee y perder la posición lumbar.",
      "Soltarse de la barra desde una caída alta.",
    ];
    progressions = [
      "Practica burpee y dominada por separado.",
      "Enlaza repeticiones con un salto bajo y controlado.",
    ];
    regressions = [
      "Camina los pies atrás y adelante en el burpee.",
      "Usa dominada con banda o salto asistido.",
    ];
    muscles = ["Pectorales", "Cuádriceps", "Glúteos", "Dorsales", "Bíceps", "Core"];
  } else if (/scapular/.test(lower)) {
    description = `${name} mueve las escápulas colgado con codos extendidos para practicar depresión y control antes de la tracción completa.`;
    technique = [
      "Cuelga con agarre firme y codos extendidos.",
      "Aleja hombros de las orejas sin doblar los brazos.",
      "Vuelve lentamente a la suspensión inicial en un rango pequeño.",
    ];
    commonMistakes = [
      "Doblar codos y convertirlo en dominada parcial.",
      "Balancear el cuerpo para ganar recorrido.",
      "Forzar una posición escapular sin control.",
    ];
    progressions = [
      "Aumenta la pausa en la posición activa.",
      "Enlaza repeticiones limpias antes de probar dominadas asistidas.",
    ];
    regressions = [
      "Apoya los pies parcialmente para descargar peso.",
      "Practica retracciones escapulares de pie con banda ligera.",
    ];
    muscles = ["Trapecio inferior", "Dorsales", "Romboides", "Core"];
  } else if (/toes-to-bar|knees-to-elbows|hanging knee raise/.test(lower)) {
    description = `${name} eleva piernas o pies desde una suspensión activa hasta el objetivo previsto. La pelvis debe iniciar el movimiento y el balanceo, si se usa, permanecer controlado.`;
    technique = [
      "Cuelga con agarre firme y hombros activos.",
      "Mantén abdomen y pelvis en control antes de elevar rodillas o pies.",
      "Toca la barra con los pies o acerca rodillas a codos sin perder el agarre.",
      "Desciende de forma controlada y reinicia el balanceo si corresponde.",
    ];
    commonMistakes = [
      "Iniciar desde hombros pasivos.",
      "Usar un kip descontrolado que golpea la zona lumbar.",
      "Soltar la bajada y perder tensión o agarre.",
    ];
    progressions = [
      "Practica elevaciones de rodillas y posiciones hollow/arch.",
      "Aumenta el rango de rodillas a pecho antes de buscar pies a barra.",
    ];
    regressions = [
      "Usa knee raises con recorrido corto.",
      "Practica compresión de cadera sentado o colgado con banda asistida.",
    ];
    muscles = ["Recto abdominal", "Flexores de cadera", "Dorsales", "Agarre", "Core"];
  } else if (/pull-up|chest-to-bar|muscle-up/.test(lower)) {
    const explosive = /kipping|butterfly|muscle-up/.test(lower);
    description = `${name} desarrolla tracción y control escapular. ${explosive ? "La coordinación de cadera y hombros genera impulso, pero la transición y recepción deben seguir bajo control." : "Inicia el tirón desde una posición activa y completa el rango previsto sin balanceo."}`;
    technique = explosive
      ? [
          "Inicia desde hombros activos y genera un balanceo pequeño y controlado.",
          "Coordina apertura y cierre de cadera con el tirón de brazos.",
          "En muscle-up, lleva el pecho sobre el implemento y termina en soporte estable.",
        ]
      : [
          "Cuelga con agarre firme y hombros activos.",
          "Lleva codos hacia abajo y atrás mientras el tronco permanece firme.",
          "Alcanza la altura objetivo y desciende sin soltar la tensión de golpe.",
        ];
    commonMistakes = [
      "Iniciar cada repetición con hombros pasivos.",
      "Usar balanceo descontrolado o acortar el rango objetivo.",
      "Perder control en la bajada o la transición sobre anillas/barra.",
    ];
    progressions = [
      "Construye suspensiones activas y remos horizontales.",
      "Añade repeticiones y velocidad solo si la posición escapular se mantiene.",
    ];
    regressions = [
      "Usa banda o apoyo de pies para asistir el tirón.",
      "Practica la transición con anillas bajas y pies en el suelo.",
    ];
    muscles = ["Dorsales", "Trapecio", "Romboides", "Bíceps", "Agarre", "Core"];
  } else if (/carry|hold|hang|pinch/.test(lower)) {
    const overhead = /overhead|waiter/.test(lower);
    description = `${name} entrena estabilidad y agarre sosteniendo o transportando una carga. ${overhead ? "El hombro debe permanecer bloqueado y la carga alineada sobre el tronco." : "La postura debe resistir inclinación y rotación durante toda la distancia o duración."}`;
    technique = [
      "Asegura el agarre y coloca la carga en la posición indicada.",
      overhead
        ? "Mantén codo extendido y hombro activo bajo la carga."
        : "Apila costillas sobre pelvis y conserva hombros nivelados.",
      "Respira con control y mantén tensión sin encoger el cuello.",
      "Termina la distancia o tiempo y deja la carga con control.",
    ];
    commonMistakes = [
      "Inclinarse o rotar para compensar la carga.",
      "Perder el agarre o dejar que el hombro se eleve hacia la oreja.",
      "Aumentar distancia antes de dominar la postura.",
    ];
    progressions = [
      "Aumenta duración o distancia antes de subir mucho el peso.",
      "Prueba posiciones de carga más exigentes cuando la base sea estable.",
    ];
    regressions = ["Reduce carga y duración.", "Practica sostén estático o marcha sin carga."];
    muscles = ["Antebrazos", "Agarre", "Trapecio", "Core", "Glúteos"];
  } else if (/step-up/.test(lower)) {
    description = `${name} entrena fuerza unilateral al subir a un cajón. La pierna apoyada arriba produce el ascenso; la pierna libre no debe impulsarte desde el suelo.`;
    technique = [
      "Apoya el pie completo y estabiliza la pelvis antes de moverte.",
      "Alinea rodilla con los dedos del pie durante el descenso o la subida.",
      "Controla la fase de bajada y evita impulsarte con la pierna libre.",
    ];
    commonMistakes = [
      "Dejar que la rodilla colapse hacia dentro.",
      "Impulsarse con la pierna que queda en el suelo.",
      "Usar un cajón o una zancada demasiado largos para mantener equilibrio.",
    ];
    progressions = [
      "Aumenta el rango o la altura antes de añadir carga.",
      "Añade carga goblet cuando cada repetición sea estable.",
    ];
    regressions = [
      "Reduce altura o usa apoyo de una mano.",
      "Practica el patrón sin carga y con recorrido corto.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Gemelos", "Core"];
  } else if (/handstand|wall walk/.test(lower)) {
    description = `${name} exige control invertido y carga progresiva sobre los hombros. Mantén una línea corporal que puedas sostener y una salida segura.`;
    technique = [
      "Empuja el suelo y eleva los hombros para crear una base activa.",
      "Aprieta abdomen y glúteos para limitar la extensión lumbar.",
      "Desplázate o sostén la posición con apoyos pequeños y controlados.",
      "Sal de la inversión de forma deliberada antes de perder la línea.",
    ];
    commonMistakes = [
      "Colapsar hombros o arquear la espalda.",
      "Alejar manos de la pared y perder la base de apoyo.",
      "Continuar cuando ya no se puede mantener una salida segura.",
    ];
    progressions = [
      "Practica pike holds y apoyos con pies elevados.",
      "Aumenta tiempo o distancia en incrementos cortos.",
    ];
    regressions = [
      "Usa pike en el suelo o pared con pies más bajos.",
      "Reduce el rango de wall walk y descansa entre repeticiones.",
    ];
    muscles = ["Deltoides", "Trapecio", "Tríceps", "Serrato anterior", "Core"];
  } else if (/sit-up|v-up|plank|russian twist/.test(lower)) {
    description = `${name} desarrolla control del tronco mediante flexión, anti-extensión o rotación. Mantén el movimiento en el segmento objetivo y evita compensar con la zona lumbar.`;
    technique = lower.includes("plank")
      ? [
          "Apoya antebrazos o mano bajo el hombro, según la variante.",
          "Mantén pelvis nivelada y costillas recogidas.",
          "Respira sin perder la tensión ni dejar caer la cadera.",
        ]
      : [
          "Fija los pies y prepara el abdomen antes de iniciar.",
          "Mueve el tronco de forma controlada sin tirar del cuello.",
          "Regresa con control y conserva la posición lumbar estable.",
        ];
    commonMistakes = [
      "Usar impulso para completar las repeticiones.",
      "Tirar de cuello o permitir que la zona lumbar se arquee.",
      "Rotar desde la espalda baja en vez de controlar el tronco.",
    ];
    progressions = [
      "Aumenta rango o duración antes de añadir carga.",
      "Añade carga ligera solo manteniendo control respiratorio.",
    ];
    regressions = [
      "Reduce rango y repeticiones.",
      "Usa una variante isométrica o con rodillas flexionadas.",
    ];
    muscles = ["Recto abdominal", "Oblicuos", "Transverso abdominal", "Flexores de cadera"];
  } else if (/l-sit/.test(lower)) {
    description = `${name} mantiene las piernas elevadas mientras los brazos sostienen el cuerpo; requiere compresión de cadera y depresión escapular sostenida.`;
    technique = [
      "Empuja las barras o el suelo para alejar hombros de las orejas.",
      "Eleva las piernas al frente y mantén rodillas extendidas según tu movilidad.",
      "Conserva pelvis y costillas controladas mientras respiras.",
    ];
    commonMistakes = [
      "Dejar caer hombros o apoyar el peso en las articulaciones sin tensión.",
      "Flexionar la cadera con impulso y perder la posición isométrica.",
      "Forzar piernas extendidas si la pelvis se inclina hacia atrás.",
    ];
    progressions = [
      "Acumula soportes con rodillas flexionadas.",
      "Extiende una pierna cada vez antes del L-sit completo.",
    ];
    regressions = [
      "Usa tuck sit con rodillas al pecho.",
      "Eleva las manos sobre bloques para ganar espacio.",
    ];
    muscles = ["Tríceps", "Deltoides", "Flexores de cadera", "Cuádriceps", "Core"];
  } else if (/bear crawl/.test(lower)) {
    description = `${name} desplaza el cuerpo en cuadrupedia con rodillas separadas del suelo. La coordinación contralateral mantiene estable el tronco mientras avanzan mano y pie opuestos.`;
    technique = [
      "Coloca manos bajo hombros y rodillas bajo caderas.",
      "Eleva las rodillas unos centímetros sin arquear la espalda.",
      "Avanza mano y pie opuestos con pasos pequeños y pelvis nivelada.",
    ];
    commonMistakes = [
      "Elevar demasiado las caderas o balancearlas de lado a lado.",
      "Dar pasos largos y perder la posición lumbar.",
      "Apoyar las rodillas entre pasos.",
    ];
    progressions = [
      "Aumenta distancia conservando pasos cortos.",
      "Añade cambios de dirección después de dominar el avance recto.",
    ];
    regressions = [
      "Mantén rodillas apoyadas y practica el patrón contralateral.",
      "Haz recorridos muy cortos con pausas para recolocarte.",
    ];
    muscles = ["Hombros", "Serrato anterior", "Core", "Cuádriceps", "Glúteos"];
  } else if (/man maker/.test(lower)) {
    description = `${name} enlaza flexión, remo desde plancha, salto de pies y un clean-and-press con mancuernas. Cada transición debe conservar la espalda firme y una base equilibrada.`;
    technique = [
      "Inicia con mancuernas estables bajo los hombros y completa una flexión controlada.",
      "Rema alternando lados sin rotar la pelvis.",
      "Salta los pies hacia las manos, limpia las mancuernas al hombro y presiónalas arriba.",
    ];
    commonMistakes = [
      "Dejar que las mancuernas rueden durante la flexión.",
      "Rotar el tronco en los remos.",
      "Elevar la carga con la espalda arqueada al levantarse o presionar.",
    ];
    progressions = [
      "Aprende flexión, renegade row y thruster por separado.",
      "Enlaza componentes con mancuernas ligeras y pausas.",
    ];
    regressions = [
      "Eleva las manos para reducir la flexión.",
      "Omite el press final o alterna componentes en series separadas.",
    ];
    muscles = ["Pectorales", "Dorsales", "Tríceps", "Cuádriceps", "Glúteos", "Core"];
  } else if (/american kettlebell swing/.test(lower)) {
    description =
      "El American Kettlebell Swing lleva la kettlebell desde la bisagra de cadera hasta una posición controlada sobre la cabeza. Requiere movilidad y estabilidad overhead suficientes para el rango completo.";
    technique = [
      "Inicia con la kettlebell delante y crea la bisagra llevando cadera atrás.",
      "Guía la kettlebell entre las piernas con espalda firme.",
      "Extiende cadera con potencia y deja que la campana suba sobre la cabeza.",
      "Frena el arco y vuelve a la bisagra sin hiperextender la espalda.",
    ];
    commonMistakes = [
      "Convertir la repetición en una elevación frontal de brazos.",
      "Extender la zona lumbar para alcanzar overhead.",
      "Perder el control de la campana en el descenso.",
    ];
    progressions = [
      "Consolida el Russian swing hasta altura de pecho.",
      "Aumenta rango overhead con carga ligera y movilidad adecuada.",
    ];
    regressions = [
      "Usa Russian Kettlebell Swing.",
      "Practica bisagras sin carga hasta controlar el arco.",
    ];
    muscles = ["Glúteos", "Isquiotibiales", "Erectores espinales", "Hombros", "Core", "Agarre"];
  } else if (/swing|kettlebell|dumbbell|renegade/.test(lower)) {
    description = `${name} combina control del implemento con producción de fuerza desde cadera y tronco. La carga debe permanecer cerca y seguir una trayectoria repetible.`;
    technique = [
      "Asegura el agarre y estabiliza el tronco antes de mover la carga.",
      "Genera el movimiento desde cadera o piernas según el patrón, no solo con los brazos.",
      "Mantén el implemento cerca y termina cada repetición con control.",
    ];
    commonMistakes = [
      "Perder la espalda neutra al recoger el implemento.",
      "Elevar la carga con los brazos cuando el patrón requiere extensión de cadera.",
      "Cambiar de mano o apoyar la carga sin control.",
    ];
    progressions = [
      "Practica cada componente del complejo por separado.",
      "Aumenta carga o densidad cuando puedas repetir el patrón sin pausas técnicas.",
    ];
    regressions = [
      "Reduce peso y practica el patrón con una sola mancuerna/kettlebell.",
      "Separa el movimiento compuesto en sus componentes básicos.",
    ];
    muscles = ["Glúteos", "Isquiotibiales", "Espalda", "Hombros", "Core", "Agarre"];
  } else if (/jump|burpee|triple under|double under|single under/.test(lower)) {
    description = `${name} requiere producir y absorber fuerza con ritmo repetible. Ajusta altura, velocidad y densidad para que cada aterrizaje siga siendo estable.`;
    technique = [
      "Carga cadera y tobillos antes del despegue.",
      "Aterriza suave con rodillas alineadas y recupera el equilibrio.",
      "Coordina respiración y cadencia antes de acelerar.",
    ];
    commonMistakes = [
      "Aterrizar rígido o con rodillas hacia dentro.",
      "Aumentar altura/velocidad cuando ya no se absorbe el impacto.",
      "En comba, mover los brazos ampliamente en vez de girar desde muñecas.",
    ];
    progressions = [
      "Practica aterrizajes o saltos individuales de baja altura.",
      "Aumenta una variable: altura, duración o velocidad.",
    ];
    regressions = [
      "Cambia saltos por pasos o reduce la altura.",
      "Usa intervalos breves con descanso suficiente.",
    ];
    muscles = ["Gemelos", "Cuádriceps", "Glúteos", "Isquiotibiales", "Sistema cardiovascular"];
  } else if (/row|ski ?erg|bike|running|sprint|swimming/.test(lower)) {
    description = `${name} es un esfuerzo cíclico. La postura y cadencia deben permitir mantener la producción de trabajo durante la distancia o intervalo programado.`;
    technique = [
      "Ajusta el equipo o la zancada a una posición cómoda y repetible.",
      "Coordina piernas, tronco y brazos sin tirones bruscos.",
      "Mantén cadencia y respiración acordes al esfuerzo previsto.",
      "Reduce el ritmo antes de que la técnica se degrade.",
    ];
    commonMistakes = [
      "Empezar a máxima intensidad y perder ritmo pronto.",
      "Acortar el recorrido o encorvarse bajo fatiga.",
      "Remar tirando solo de brazos o pedalear con cadencia descontrolada.",
    ];
    progressions = [
      "Aumenta tiempo o distancia manteniendo un ritmo uniforme.",
      "Introduce intervalos rápidos tras consolidar la base aeróbica.",
    ];
    regressions = [
      "Reduce ritmo y duración.",
      "Alterna trabajo y recuperación o usa una modalidad de menor impacto.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Isquiotibiales", "Espalda", "Sistema cardiovascular"];
  } else if (/sled/.test(lower)) {
    const backward = lower.includes("backward");
    description = `${name} desplaza una carga externa mediante pasos constantes. ${backward ? "El arrastre hacia atrás enfatiza la extensión de rodilla y exige pasos cortos mirando el recorrido." : "La dirección de tracción determina la inclinación del tronco y la colocación de las manos o el arnés."}`;
    technique = [
      "Conecta manos o arnés y crea tensión antes de iniciar.",
      backward
        ? "Camina hacia atrás con pasos cortos y rodillas flexionadas."
        : "Inclina el cuerpo como una unidad y empuja desde el suelo.",
      "Mantén ritmo regular y despeja el trayecto antes de acelerar.",
    ];
    commonMistakes = [
      "Dar pasos largos que hacen perder tracción.",
      "Redondear la espalda o tirar solo con brazos.",
      "Elegir una carga que impide mantener el movimiento continuo.",
    ];
    progressions = [
      "Aumenta distancia antes que carga.",
      "Prueba cambios de dirección cuando controles el arrastre recto.",
    ];
    regressions = ["Reduce carga o distancia.", "Usa un ritmo lento con descansos planificados."];
    muscles = backward
      ? ["Cuádriceps", "Glúteos", "Gemelos", "Core"]
      : ["Cuádriceps", "Glúteos", "Hombros", "Core"];
  } else if (/sandbag|med ball|wall ball/.test(lower)) {
    description = `${name} requiere manejar un implemento blando o balón que puede desplazarse durante la repetición. Abraza o guía la carga cerca del cuerpo y controla la recepción.`;
    technique = [
      "Coloca pies y agarre antes de levantar el implemento.",
      "Mantén la carga cerca del tronco y usa piernas y cadera para elevarla.",
      "Recibe o deposita con control; no dejes que el implemento arrastre la postura.",
    ];
    commonMistakes = [
      "Levantar con espalda flexionada y carga alejada.",
      "Perder el agarre cuando el implemento rota.",
      "Acelerar la recepción sin fijar pies y tronco.",
    ];
    progressions = [
      "Practica primero el levantamiento y la recepción con una carga ligera.",
      "Aumenta altura, distancia o peso de forma gradual.",
    ];
    regressions = [
      "Reduce peso y rango de elevación.",
      "Usa un balón ligero o practica la posición de carga sin desplazamiento.",
    ];
    muscles = ["Cuádriceps", "Glúteos", "Espalda", "Hombros", "Core", "Agarre"];
  } else if (/rope climb/.test(lower)) {
    description = `${name} asciende por la cuerda usando agarre y, salvo en la variante legless, un bloqueo eficiente de pies. Desciende con control para conservar el agarre.`;
    technique = [
      "Alcanza la cuerda con hombros activos y cierra el agarre.",
      "En la variante con piernas, fija la cuerda entre los pies antes de extender cadera y rodillas.",
      "Avanza las manos por encima del bloqueo y desciende por tramos controlados.",
    ];
    commonMistakes = [
      "Tirar únicamente con brazos sin fijar los pies.",
      "Reajustar el agarre sin asegurar la cuerda.",
      "Deslizarse rápidamente al bajar.",
    ];
    progressions = [
      "Practica bloqueos de pie y ascensos parciales.",
      "Aumenta altura solo cuando puedas controlar también el descenso.",
    ];
    regressions = [
      "Haz bloqueos sentado o ascensos desde poca altura.",
      "Usa cuerda horizontal o tirones con pies apoyados.",
    ];
    muscles = ["Agarre", "Dorsales", "Bíceps", "Flexores de cadera", "Core"];
  } else {
    const cues = categoryCues[fallbackCategory];
    description = `${name}: ${cues.description} La ejecución prioriza el patrón propio del movimiento y un rango que puedas controlar.`;
    technique = cues.technique;
    commonMistakes = cues.mistakes;
    progressions = cues.progressions;
    regressions = cues.regressions;
    muscles = categoryMuscles[fallbackCategory] ?? ["Piernas", "Core"];
  }

  return { description, technique, commonMistakes, progressions, regressions, muscles };
}

export const movements: Movement[] = seeds.map(
  (
    [
      name,
      nameEs,
      aliases,
      equipment,
      category,
      level = ["Halterofilia", "Gimnásticos"].includes(category) ? "Intermediate" : "Beginner",
    ],
    index,
  ) => {
    const rm = rmMovements.has(name);
    const guidance = movementGuidance(name, category);
    return {
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
      description: guidance.description,
      technique: guidance.technique,
      commonMistakes: guidance.commonMistakes,
      progressions: guidance.progressions,
      regressions: guidance.regressions,
      muscles: guidance.muscles,
      videoUrl:
        name === "Squat"
          ? "https://www.youtube.com/watch?v=rMvwVtlqjTE"
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} CrossFit movement demo`)}`,
    };
  },
);

export const MOVEMENT_CATEGORIES = [...new Set(movements.map((m) => m.category))].sort();
export const MOVEMENT_EQUIPMENT = [...new Set(movements.flatMap((m) => m.equipment))].sort();
