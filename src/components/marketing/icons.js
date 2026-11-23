import {
  CalendarCheck, ListChecks, MessageSquareText, MessagesSquare, Moon, PhoneForwarded, Search, UserPlus,
} from 'lucide-react';

/** Icons referenced by name from src/data/use-cases.js. */
export const ICONS = {
  CalendarCheck,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Moon,
  PhoneForwarded,
  Search,
  UserPlus,
};

export function Icon({ name, className }) {
  const Component = ICONS[name] || MessagesSquare;
  return <Component className={className} aria-hidden="true" />;
}
