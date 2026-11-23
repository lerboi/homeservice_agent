import {
  CalendarCheck, ClipboardList, Inbox, LifeBuoy, ListChecks, MessageSquareText, MessagesSquare, Moon,
  PhoneForwarded, Search, Star, TrendingUp, UserPlus,
} from 'lucide-react';

/** Icons referenced by name from src/data/use-cases.js and src/data/agent.js. */
export const ICONS = {
  CalendarCheck,
  ClipboardList,
  Inbox,
  LifeBuoy,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Moon,
  PhoneForwarded,
  Search,
  Star,
  TrendingUp,
  UserPlus,
};

export function Icon({ name, className }) {
  const Component = ICONS[name] || MessagesSquare;
  return <Component className={className} aria-hidden="true" />;
}
