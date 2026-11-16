'use client';

import { DismissOverlay, SidePanel } from '@/components/ui';
import { NewTransaction, SideMenu, Tooltip } from '@/components';
import { useProfileImage } from '@/hooks';
import useCompactMenu from '@/hooks/useCompactMenu.hook';
import useHideOnScroll from '@/hooks/useHideOnScroll.hook';
import { useI18n } from '@/i18n/useI18n';
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscRobot } from 'react-icons/vsc';

export default function Header(): JSX.Element {
  const { data: profileImage } = useProfileImage();
  const { t } = useI18n();

  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const profileImageUrl: string | undefined = useMemo(
    (): string | undefined =>
      profileImage ? URL.createObjectURL(profileImage) : undefined,
    [profileImage]
  );

  useEffect((): (() => void) | undefined => {
    if (!profileImageUrl) {
      return undefined;
    }

    return (): void => URL.revokeObjectURL(profileImageUrl);
  }, [profileImageUrl]);

  const hidden: boolean = useHideOnScroll(isLeftOpen || isEntryOpen);
  const { compact, setCompact } = useCompactMenu();

  function closeMenu(): void {
    setIsLeftOpen(false);
    setIsEntryOpen(false);
  }

  // From md up the side menu is a permanent rail (full or icons only) and there is no top bar;
  // phones keep the top bar with the menu and new-transaction buttons. New transaction opens in
  // the shared side panel, from the left like every panel. The drawers and overlay
  // stay outside the sliding bar: a translated parent would become their containing block,
  // pushing the closed drawers into the page and making it scroll sideways.
  return (
    <>
      <aside
        data-testid="side-rail"
        className={clsx(
          'sticky top-0 z-40 hidden h-screen shrink-0 border-r border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] md:block',
          compact ? 'w-16' : 'w-64'
        )}
      >
        <SideMenu
          compact={compact}
          onClose={closeMenu}
          onToggleCompact={(): void => setCompact(!compact)}
          onNewEntry={(): void => setIsEntryOpen(true)}
        />
      </aside>
      <div
        data-testid="header-bar"
        className={clsx(
          'sticky top-0 z-30 w-full border-b border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] px-4 text-[var(--ctp-text)] shadow-md motion-safe:transition-transform motion-safe:duration-200 md:hidden',
          hidden && '-translate-y-full'
        )}
      >
        <header className="flex justify-between py-2">
          <Tooltip tooltip={t.header.menuTooltip} placement="right">
            {profileImageUrl ? (
              <div className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full">
                <Image
                  src={profileImageUrl}
                  onClick={(): void =>
                    setIsLeftOpen((prev: boolean): boolean => !prev)
                  }
                  className="object-cover"
                  alt={t.header.profileAlt}
                  fill
                />
              </div>
            ) : (
              <VscRobot
                size={44}
                className="cursor-pointer rounded-md p-1 hover:text-[var(--ctp-subtext0)]"
                onClick={(): void =>
                  setIsLeftOpen((prev: boolean): boolean => !prev)
                }
              />
            )}
          </Tooltip>
          <Tooltip tooltip={t.header.newTransactionTooltip} placement="left">
            <AiOutlinePlus
              className="cursor-pointer rounded-md p-1 hover:text-[var(--ctp-subtext0)]"
              size={44}
              onClick={(): void =>
                setIsEntryOpen((prev: boolean): boolean => !prev)
              }
            />
          </Tooltip>
        </header>
      </div>
      {isLeftOpen && (
        <DismissOverlay aria-label={t.common.cancel} onClick={closeMenu} />
      )}
      <div
        inert={!isLeftOpen}
        data-testid="side-menu-drawer"
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-72 max-w-full transform bg-[var(--ctp-mantle)] shadow-lg transition-transform duration-300 md:hidden',
          isLeftOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none -translate-x-full'
        )}
      >
        <SideMenu onClose={closeMenu} />
      </div>
      {isEntryOpen && (
        <SidePanel
          testId="new-entry-drawer"
          title={t.header.newTransactionTooltip}
          onClose={closeMenu}
        >
          <NewTransaction onClose={closeMenu} />
        </SidePanel>
      )}
    </>
  );
}
