// Набор возможностей motion отдельным модулем — ради отдельного чанка: его
// подгружает MotionProvider (lib/motion.tsx) после первого рендера. domMax, а не
// domAnimation: индикатору нижней панели нужен layoutId, листу «Ещё» — drag.
import { domMax } from 'motion/react'

export default domMax
