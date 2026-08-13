export type Movement = {
  name: string;
  category: "Halterofilia" | "Gimnásticos" | "Fuerza" | "Monoestructural" | "Accesorios";
  cues: string;
  videoId: string;
};

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export function videoUrl(m: Movement) {
  return m.videoId ? yt(m.videoId) : `https://www.youtube.com/results?search_query=${encodeURIComponent(m.name + " crossfit technique")}`;
}

export function thumbUrl(m: Movement) {
  return m.videoId ? `https://i.ytimg.com/vi/${m.videoId}/hqdefault.jpg` : "";
}

export const MOVEMENTS: Movement[] = [
  { name: "Snatch", category: "Halterofilia", cues: "Barra pegada al cuerpo, extensión triple y recepción en sentadilla.", videoId: "9xQp2sldyts" },
  { name: "Power Snatch", category: "Halterofilia", cues: "Recepción por encima del paralelo, hombros activos.", videoId: "9xQp2sldyts" },
  { name: "Hang Snatch", category: "Halterofilia", cues: "Inicio desde la cadera, bisagra y extensión rápida.", videoId: "TL7bO3sFDBc" },
  { name: "Clean", category: "Halterofilia", cues: "Tirón paciente, codos rápidos y rack sólido.", videoId: "EKRiW9Yt3Ps" },
  { name: "Power Clean", category: "Halterofilia", cues: "Recepción alta, torso vertical.", videoId: "KfjS0EYyGmY" },
  { name: "Clean & Jerk", category: "Halterofilia", cues: "Cargada limpia, dip vertical y jerk bajo la barra.", videoId: "EKRiW9Yt3Ps" },
  { name: "Split Jerk", category: "Halterofilia", cues: "Dip corto, pies en tijera y bloqueo de codos.", videoId: "6XVJ3Bg9U8U" },
  { name: "Push Jerk", category: "Halterofilia", cues: "Dip-drive y recepción en semisentadilla.", videoId: "6XVJ3Bg9U8U" },
  { name: "Thruster", category: "Halterofilia", cues: "Front squat completo encadenado con press.", videoId: "L219ltL15zk" },
  { name: "Overhead Squat", category: "Halterofilia", cues: "Barra sobre la mitad del pie, axilas activas.", videoId: "RD_vUnqwqqI" },

  { name: "Back Squat", category: "Fuerza", cues: "Cadera atrás, rodillas fuera, core firme.", videoId: "ultWZbUMPL8" },
  { name: "Front Squat", category: "Fuerza", cues: "Codos altos, torso vertical.", videoId: "uYumuL_G_V0" },
  { name: "Deadlift", category: "Fuerza", cues: "Espalda neutra, barra pegada a la tibia.", videoId: "op9kVnSso6Q" },
  { name: "Strict Press", category: "Fuerza", cues: "Glúteo apretado, cabeza fuera del camino.", videoId: "5yWaNOvgFCM" },
  { name: "Push Press", category: "Fuerza", cues: "Dip vertical corto y extensión explosiva.", videoId: "iaBVSJm78ko" },
  { name: "Bench Press", category: "Fuerza", cues: "Escápulas retraídas, barra a la línea del pecho.", videoId: "rT7DgCr-3pg" },
  { name: "Barbell Row", category: "Fuerza", cues: "Bisagra estable, codos a la cadera.", videoId: "9efgcAjQe7E" },

  { name: "Pull-up", category: "Gimnásticos", cues: "Barbilla sobre la barra, escápulas activas.", videoId: "eGo4IYlbE5g" },
  { name: "Chest to Bar", category: "Gimnásticos", cues: "Contacto del pecho, tirón agresivo.", videoId: "_Sh2h1Ovlkc" },
  { name: "Muscle-up", category: "Gimnásticos", cues: "Arco-hueco, transición rápida y press final.", videoId: "-D5gp_Ntsi0" },
  { name: "Ring Muscle-up", category: "Gimnásticos", cues: "Falsa presa, anillas pegadas al cuerpo.", videoId: "-D5gp_Ntsi0" },
  { name: "Toes to Bar", category: "Gimnásticos", cues: "Kipping controlado, pies a la barra.", videoId: "6NPMaLXHc9E" },
  { name: "Handstand Push-up", category: "Gimnásticos", cues: "Trípode de cabeza y manos, core apretado.", videoId: "0wDDrYS0z7c" },
  { name: "Handstand Walk", category: "Gimnásticos", cues: "Hombros sobre las manos, mirada al suelo.", videoId: "3vBjTUC5tAQ" },
  { name: "Ring Dip", category: "Gimnásticos", cues: "Bloqueo arriba, anillas giradas hacia fuera.", videoId: "EWXVdOsQPPg" },
  { name: "Burpee", category: "Gimnásticos", cues: "Pecho al suelo y salto con extensión completa.", videoId: "auBLPXO8Fww" },
  { name: "Box Jump", category: "Gimnásticos", cues: "Aterrizaje suave, extensión de cadera arriba.", videoId: "52r_Ul5k03g" },
  { name: "Pistol Squat", category: "Gimnásticos", cues: "Pierna libre extendida, control excéntrico.", videoId: "vq5-vdgJc0I" },
  { name: "Rope Climb", category: "Gimnásticos", cues: "Anclaje de pies J-hook y extensión de piernas.", videoId: "aQ3iA2eOr_A" },

  { name: "Row (Remo)", category: "Monoestructural", cues: "Piernas-cadera-brazos, retorno inverso.", videoId: "zQ82RYIFLN8" },
  { name: "Assault Bike", category: "Monoestructural", cues: "Ritmo constante, respiración controlada.", videoId: "gm_QF9pTHUE" },
  { name: "Double Under", category: "Monoestructural", cues: "Muñecas rápidas, salto bajo y constante.", videoId: "82jNjDS19lg" },
  { name: "Ski Erg", category: "Monoestructural", cues: "Compresión de cadera y tirón completo.", videoId: "GHfzWtEsZlA" },
  { name: "Wall Ball", category: "Monoestructural", cues: "Squat completo y lanzamiento al objetivo.", videoId: "fpVWr8Sk-2c" },

  { name: "Kettlebell Swing", category: "Accesorios", cues: "Bisagra de cadera, no sentadilla.", videoId: "mKDIuUbH94Q" },
  { name: "Devil Press", category: "Accesorios", cues: "Burpee con mancuernas y swing a overhead.", videoId: "0iBEeaGRQlU" },
  { name: "Dumbbell Snatch", category: "Accesorios", cues: "Trayectoria cercana al cuerpo, bloqueo arriba.", videoId: "9526FEHtE5s" },
  { name: "GHD Sit-up", category: "Accesorios", cues: "Rango progresivo, evita hiperextensión brusca.", videoId: "F0Nc7BqXCPk" },
  { name: "Turkish Get-up", category: "Accesorios", cues: "Secuencia lenta, mirada a la pesa.", videoId: "0bWRPC49-KI" },
  { name: "Hip Thrust", category: "Accesorios", cues: "Barbilla metida, bloqueo de glúteo arriba.", videoId: "LM8XHLYJoYs" },
];
