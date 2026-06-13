// ============================================================
// Component tree — stubs ready for implementation
//
// /ui           — generic, reusable primitives
// /room         — room-level components
// /prediction   — prediction lifecycle components
// /leaderboard  — leaderboard and player stats
// ============================================================

// -- ui --
export { Button } from './ui/button'
export { Input } from './ui/input'
export { Toaster } from './ui/sonner'
export { Badge } from './ui/badge'
export { Progress } from './ui/progress'
export { Skeleton } from './ui/skeleton'
export { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from './ui/field'
export { RadioGroup, RadioGroupItem } from './ui/radio-group'
export { Spinner, Loading, PingLoading } from './ui/spinner'
export { Dialog, DialogContent, DialogClose, DialogDescription, DialogFooter, DialogTrigger, DialogHeader, DialogTitle } from './ui/dialog'
export { Drawer, DrawerTrigger, DrawerDescription, DrawerClose, DrawerFooter, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer'
export { Separator } from './ui/separator'
export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './ui/input-otp'
export { Alert, AlertDescription, AlertTitle, AlertAction } from './ui/alert'
export { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card'
export { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
export { ScrollArea, ScrollBar } from './ui/scroll-area'
export { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
export { Carousel, CarouselItem } from './ui/carousel'
export { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

// -- animations --
export { default as Counter } from './animations/counter'
export { default as FadeContent } from './animations/fade-content'
export { default as CountUp } from './animations/count-up'