'use client';

import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// M16 P1 (Capability A) — the single Service Area editor. Replaces the
// multi-zone ZoneManager + the zone_travel_buffers matrix. Two flat coverage
// lists (postal codes + towns) feed the agent's at-validation membership gate;
// the out-of-area action tells the AI what to do with a caller outside it.

const OUT_OF_AREA_OPTIONS = [
  {
    value: 'callback',
    label: 'Take a message & call them back',
    help: 'The AI never books an out-of-area time. It takes the caller’s details and tells them you’ll call back to confirm you can reach them. The safest choice — you never lose the lead.',
  },
  {
    value: 'decline_referral',
    label: 'Politely decline (optional referral)',
    help: 'The AI politely lets the caller know it’s outside your area and, if you add a referral below, passes it along. Their details are still saved so you have the lead.',
  },
  {
    value: 'trip_fee',
    label: 'Book it, but mention a possible travel fee',
    help: 'The AI books the job as normal but gently notes there may be an extra travel charge you’ll confirm. Use this if you’ll travel further for a fee.',
  },
];

/** Generic comma/Enter chip editor (controlled). */
function ChipInput({ items, onChange, placeholder, ariaLabel }) {
  const [value, setValue] = useState('');

  function add(raw) {
    const v = (raw ?? '').trim().replace(/,$/, '');
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setValue('');
      return;
    }
    onChange([...items, v]);
    setValue('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(value);
    } else if (e.key === 'Backspace' && !value && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-muted min-h-10">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 bg-foreground/[0.06] text-foreground/70 text-xs rounded-full px-2 h-7"
        >
          {item}
          <button
            type="button"
            onClick={() => onChange(items.filter((i) => i !== item))}
            className="text-muted-foreground hover:text-foreground/80 transition-colors ml-0.5"
            aria-label={`Remove ${item}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => add(value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 h-7 text-xs border-0 outline-none focus:ring-0 bg-transparent placeholder:text-muted-foreground"
      />
    </div>
  );
}

const EMPTY = { postal_codes: [], cities: [], out_of_area_action: 'callback', out_of_area_referral_note: '' };

export default function ServiceAreaManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postalCodes, setPostalCodes] = useState([]);
  const [cities, setCities] = useState([]);
  const [action, setAction] = useState('callback');
  const [referralNote, setReferralNote] = useState('');
  // Baseline snapshot held in STATE (not a ref) so the dirty check can read it
  // during render without tripping react-hooks/refs.
  const [initial, setInitial] = useState(EMPTY);

  async function load() {
    try {
      const res = await fetch('/api/service-area');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const next = {
        postal_codes: data.postal_codes || [],
        cities: data.cities || [],
        out_of_area_action: data.out_of_area_action || 'callback',
        out_of_area_referral_note: data.out_of_area_referral_note || '',
      };
      setPostalCodes(next.postal_codes);
      setCities(next.cities);
      setAction(next.out_of_area_action);
      setReferralNote(next.out_of_area_referral_note);
      setInitial(next);
    } catch {
      toast.error('Failed to load your service area.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // One-shot fetch-on-mount; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const dirty =
    JSON.stringify(postalCodes) !== JSON.stringify(initial.postal_codes) ||
    JSON.stringify(cities) !== JSON.stringify(initial.cities) ||
    action !== initial.out_of_area_action ||
    referralNote.trim() !== (initial.out_of_area_referral_note || '').trim();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/service-area', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postal_codes: postalCodes,
          cities,
          out_of_area_action: action,
          out_of_area_referral_note: referralNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      const data = await res.json();
      const saved = {
        postal_codes: data.postal_codes || [],
        cities: data.cities || [],
        out_of_area_action: data.out_of_area_action || 'callback',
        out_of_area_referral_note: data.out_of_area_referral_note || '',
      };
      setInitial(saved);
      setPostalCodes(saved.postal_codes);
      setCities(saved.cities);
      setAction(saved.out_of_area_action);
      setReferralNote(saved.out_of_area_referral_note);
      toast.success('Service area saved.');
    } catch (err) {
      toast.error(err.message || "Service area couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </section>
    );
  }

  const noCoverage = postalCodes.length === 0 && cities.length === 0;
  const selectedOption = OUT_OF_AREA_OPTIONS.find((o) => o.value === action) || OUT_OF_AREA_OPTIONS[0];

  return (
    <section className="space-y-8">
      {/* Coverage lists */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Areas you serve</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Postal / ZIP codes</Label>
            <ChipInput
              items={postalCodes}
              onChange={setPostalCodes}
              placeholder="Add a postal code…"
              ariaLabel="Add a postal or ZIP code you serve"
            />
            <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Towns &amp; cities</Label>
            <ChipInput
              items={cities}
              onChange={setCities}
              placeholder="Add a town or city…"
              ariaLabel="Add a town or city you serve"
            />
            <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
          </div>
        </div>

        {noCoverage && (
          <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Until you add at least one postal code or town, the AI will treat every caller as in-area
              and book them as normal — it never turns a caller away on a guess.
            </p>
          </div>
        )}
      </div>

      {/* Out-of-area handling */}
      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">When someone&apos;s outside your area</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            What the AI does when a caller&apos;s confirmed address falls outside the areas above. The lead
            is always saved and you&apos;re always notified — these options only change what the AI offers.
          </p>
        </div>

        <div className="max-w-md space-y-1.5">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUT_OF_AREA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{selectedOption.help}</p>
        </div>

        {action === 'decline_referral' && (
          <div className="max-w-md space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Referral to offer (optional)</Label>
            <Textarea
              value={referralNote}
              onChange={(e) => setReferralNote(e.target.value)}
              placeholder="e.g. Try ABC Plumbing at (555) 123-4567"
              rows={2}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The AI may share this with out-of-area callers. Leave blank to decline without a referral.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save service area'}
        </Button>
        {dirty && !saving && (
          <span className="text-xs text-muted-foreground">You have unsaved changes</span>
        )}
      </div>
    </section>
  );
}
