import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { numbers } = body;

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return NextResponse.json({ error: 'numbers array is required' }, { status: 400 });
  }

  const errors = [];
  const validNumbers = [];

  for (const item of numbers) {
    const raw = typeof item === 'object' ? item.phone_number : item;
    const rawStr = String(raw).trim();

    // Normalize: prepend +65 if not already present
    const normalized = rawStr.startsWith('+65') ? rawStr : '+65' + rawStr;

    // Validate: must match +65 followed by exactly 8 digits
    if (!/^\+65\d{8}$/.test(normalized)) {
      errors.push({ phone_number: rawStr, reason: 'Invalid format — expected 8 local digits' });
    } else {
      validNumbers.push(normalized);
    }
  }

  if (validNumbers.length === 0) {
    return NextResponse.json(
      { inserted: 0, errors },
      { status: errors.length > 0 ? 422 : 400 }
    );
  }

  // Insert valid numbers — handle partial duplicates by inserting individually
  let insertedCount = 0;

  for (const phoneNumber of validNumbers) {
    const { error } = await supabase
      .from('phone_inventory')
      .insert({ phone_number: phoneNumber, country: 'SG', status: 'available' });

    if (error) {
      if (error.code === '23505') {
        errors.push({ phone_number: phoneNumber, reason: 'Duplicate — number already exists' });
      } else {
        errors.push({ phone_number: phoneNumber, reason: error.message });
      }
    } else {
      insertedCount++;
    }
  }

  return NextResponse.json({ inserted: insertedCount, errors });
}
