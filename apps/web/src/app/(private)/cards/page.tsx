import { redirect } from 'next/navigation';

/** Cards now live on the Accounts page; old links keep working. */
export default function CardsPage(): never {
  redirect('/accounts');
}
