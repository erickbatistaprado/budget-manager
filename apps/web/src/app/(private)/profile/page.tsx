import { redirect } from 'next/navigation';

/** Profile now lives inside Settings; old links keep working. */
export default function ProfilePage(): never {
  redirect('/settings');
}
