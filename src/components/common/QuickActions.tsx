import React, { useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  MessageCircle,
  Send,
  Globe,
  MapPin,
  Copy,
  Pin,
  PinOff,
  Share2,
  Link as LinkIcon,
  Archive,
  ArchiveRestore,
  Search,
  Image as ImageIcon,
  MoreHorizontal,
  ExternalLink,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/ui";
import { MenuItem, MenuLabel, Dropdown } from "@/components/ui/ui";
import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
  TiktokIcon as Music2,
} from "@/components/ui/socials";
import {
  copyAllInfo,
  copyContactInfo,
  copyText,
  resolveTelegram,
  safeUrl,
  googleImagesUrl,
  googleSearchUrl,
  telHref,
  waHref,
  toIntlPhone,
} from "@/lib/utils";
import { leadsRepo } from "@/lib/repos";
import type { Lead } from "@/lib/types";
import { WebsiteBriefDialog } from "@/components/leads/WebsiteBriefDialog";

export function useCopy() {
  return async (text: string, label = "Copied") => {
    const ok = await copyText(text);
    if (ok) toast.success(label);
    else toast.error("Copy failed");
    return ok;
  };
}

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  active?: boolean;
  className?: string;
}

export function ActionBtn({
  icon,
  label,
  onClick,
  href,
  target = "_blank",
  disabled,
  size = "sm",
  active,
  className,
}: ActionBtnProps) {
  // Icon-only actions — label stays in title/aria for accessibility
  const cls =
    size === "sm"
      ? "h-8 w-8 shrink-0 rounded-lg p-0"
      : "h-10 w-10 shrink-0 rounded-xl p-0";
  const content = (
    <Button
      variant={active ? "secondary" : "outline"}
      className={`${cls} font-medium ${active ? "ring-1 ring-slate-900/20 dark:ring-white/20" : ""} ${className || ""}`}
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {icon}
    </Button>
  );
  if (href && !disabled) {
    return (
      <a href={href} target={target} rel="noreferrer" onClick={(e) => e.stopPropagation()} title={label}>
        {content}
      </a>
    );
  }
  return content;
}

export function TelegramButton({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const res = resolveTelegram(lead);
  const copy = useCopy();

  if (res.kind === "none") return null;

  // Phone-based Telegram: only open the menu — never navigate until user picks an option
  if (res.kind === "phone") {
    return (
      <Dropdown
        trigger={({ toggle }) => (
          <ActionBtn
            size={size}
            icon={<Send className="h-3.5 w-3.5" />}
            label="Telegram"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
          />
        )}
        panelClassName="w-56"
      >
        {({ close }) => (
          <>
            <MenuLabel>Telegram for {lead.business_name || "lead"}</MenuLabel>
            <MenuItem
              icon={<Send className="h-4 w-4" />}
              onClick={() => {
                window.location.href = res.tgUrl;
                close();
              }}
            >
              Open Telegram app
            </MenuItem>
            <MenuItem
              icon={<Globe className="h-4 w-4" />}
              onClick={() => {
                window.open(res.webUrl, "_blank");
                close();
              }}
            >
              Open t.me/+{toIntlPhone(lead.phone)}
            </MenuItem>
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void copy(res.phone, "Number copied");
                close();
              }}
            >
              Copy number {res.phone}
            </MenuItem>
          </>
        )}
      </Dropdown>
    );
  }

  return (
    <a href={res.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <ActionBtn size={size} icon={<Send className="h-3.5 w-3.5" />} label="Telegram" />
    </a>
  );
}

export function ResearchMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const website = safeUrl(lead.website);
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <ActionBtn
          size={size}
          icon={<Search className="h-3.5 w-3.5" />}
          label="Research"
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
        />
      )}
      panelClassName="w-60"
    >
      {({ close }) => (
        <>
          <MenuLabel>Research</MenuLabel>
          <MenuItem
            icon={<Search className="h-4 w-4" />}
            onClick={() => {
              window.open(googleSearchUrl(lead), "_blank");
              close();
            }}
          >
            Google Search
          </MenuItem>
          <MenuItem
            icon={<ImageIcon className="h-4 w-4" />}
            onClick={() => {
              window.open(googleImagesUrl(lead), "_blank");
              close();
            }}
          >
            Google Images
          </MenuItem>
          {lead.google_maps_url ? (
            <MenuItem
              icon={<MapPin className="h-4 w-4" />}
              onClick={() => {
                window.open(safeUrl(lead.google_maps_url) || lead.google_maps_url, "_blank");
                close();
              }}
            >
              Google Maps
            </MenuItem>
          ) : null}
          {website ? (
            <MenuItem
              icon={<Globe className="h-4 w-4" />}
              onClick={() => {
                window.open(website, "_blank");
                close();
              }}
            >
              Website
            </MenuItem>
          ) : null}
          {lead.facebook_url ? (
            <MenuItem
              icon={<Facebook className="h-4 w-4" />}
              onClick={() => {
                window.open(safeUrl(lead.facebook_url)!, "_blank");
                close();
              }}
            >
              Facebook
            </MenuItem>
          ) : null}
          {lead.instagram_url ? (
            <MenuItem
              icon={<Instagram className="h-4 w-4" />}
              onClick={() => {
                window.open(safeUrl(lead.instagram_url)!, "_blank");
                close();
              }}
            >
              Instagram
            </MenuItem>
          ) : null}
          {lead.tiktok_url ? (
            <MenuItem
              icon={<Music2 className="h-4 w-4" />}
              onClick={() => {
                window.open(safeUrl(lead.tiktok_url)!, "_blank");
                close();
              }}
            >
              TikTok
            </MenuItem>
          ) : null}
          {lead.linkedin_url ? (
            <MenuItem
              icon={<Linkedin className="h-4 w-4" />}
              onClick={() => {
                window.open(safeUrl(lead.linkedin_url)!, "_blank");
                close();
              }}
            >
              LinkedIn
            </MenuItem>
          ) : null}
        </>
      )}
    </Dropdown>
  );
}

export function MessageMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const hasPhone = Boolean(lead.phone);
  const tg = resolveTelegram(lead);
  if (!hasPhone && tg.kind === "none") return null;
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <ActionBtn
          size={size}
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Message"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
        />
      )}
      panelClassName="w-52"
    >
      {({ close }) => (
        <>
          <MenuLabel>Message</MenuLabel>
          {hasPhone && (
            <MenuItem
              icon={<MessageCircle className="h-4 w-4" />}
              onClick={() => {
                window.open(waHref(lead.phone), "_blank");
                close();
              }}
            >
              WhatsApp
            </MenuItem>
          )}
          {tg.kind === "username" && (
            <MenuItem
              icon={<Send className="h-4 w-4" />}
              onClick={() => {
                window.open((tg as any).url, "_blank");
                close();
              }}
            >
              Telegram
            </MenuItem>
          )}
          {tg.kind === "phone" && (
            <>
              <MenuItem
                icon={<Send className="h-4 w-4" />}
                onClick={() => {
                  window.location.href = tg.tgUrl;
                  close();
                }}
              >
                Telegram app
              </MenuItem>
              <MenuItem
                icon={<Globe className="h-4 w-4" />}
                onClick={() => {
                  window.open(tg.webUrl, "_blank");
                  close();
                }}
              >
                Open t.me
              </MenuItem>
            </>
          )}
        </>
      )}
    </Dropdown>
  );
}

/** Stable CRM deep link (hash router) */
export function crmLeadUrl(leadId: string): string {
  const path = (location.pathname || "/").replace(/\/$/, "") || "";
  return `${location.origin}${path}/#/leads/${leadId}`;
}

export function CopyMenu({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const copy = useCopy();
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <>
      <Dropdown
        trigger={({ toggle }) => (
          <ActionBtn
            size={size}
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Copy"
            onClick={(e) => {
              e.preventDefault();
              toggle();
            }}
          />
        )}
        panelClassName="w-56"
      >
        {({ close }) => (
          <>
            <MenuLabel>Copy</MenuLabel>
            {lead.phone && (
              <MenuItem
                icon={<Phone className="h-4 w-4" />}
                onClick={() => {
                  void copy(lead.phone, "Phone copied");
                  close();
                }}
              >
                Copy phone
              </MenuItem>
            )}
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void copy(copyAllInfo(lead), "All info copied");
                close();
              }}
            >
              Copy all info
            </MenuItem>
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void copy(copyContactInfo(lead), "Contact info copied");
                close();
              }}
            >
              Copy contact
            </MenuItem>
            <MenuItem
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => {
                close();
                setBriefOpen(true);
              }}
            >
              Copy website brief…
            </MenuItem>
            <MenuItem
              icon={<LinkIcon className="h-4 w-4" />}
              onClick={() => {
                void copy(crmLeadUrl(lead.id), "CRM link copied");
                close();
              }}
            >
              Copy CRM link
            </MenuItem>
          </>
        )}
      </Dropdown>
      <WebsiteBriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} lead={lead} />
    </>
  );
}

export function SocialIcons({ lead, className }: { lead: Lead; className?: string }) {
  const items = [
    { url: safeUrl(lead.facebook_url), icon: Facebook, label: "Facebook" },
    { url: safeUrl(lead.instagram_url), icon: Instagram, label: "Instagram" },
    { url: safeUrl(lead.tiktok_url), icon: Music2, label: "TikTok" },
    { url: safeUrl(lead.linkedin_url), icon: Linkedin, label: "LinkedIn" },
    {
      url: resolveTelegram(lead).kind === "username" ? (resolveTelegram(lead) as any).url : safeUrl(lead.telegram_url),
      icon: Send,
      label: "Telegram",
    },
  ].filter((i) => i.url);

  if (!items.length) return null;
  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      {items.map((i) => (
        <a
          key={i.label}
          href={i.url!}
          target="_blank"
          rel="noreferrer"
          title={i.label}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <i.icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

export interface QuickActionsProps {
  lead: Lead;
  size?: "sm" | "md";
  /** Desktop default: grouped Message / Search / Copy. Call only on phone or phoneMode. */
  show?: (
    | "call"
    | "message"
    | "wa"
    | "tg"
    | "maps"
    | "web"
    | "research"
    | "copy"
    | "pin"
    | "archive"
    | "share"
    | "more"
  )[];
  /** Force large call button (Call Mode / mobile) */
  phoneMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  className?: string;
}

function useIsPhoneViewport() {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const fn = () => setPhone(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return phone;
}

export function QuickActions({
  lead,
  size = "sm",
  show = ["message", "research", "copy", "pin"],
  phoneMode = false,
  onEdit,
  onDelete,
  onOpen,
  className,
}: QuickActionsProps) {
  const copy = useCopy();
  const [copied, setCopied] = useState(false);
  const isPhone = useIsPhoneViewport();
  // Never auto-inject Call into table/card rows — only Call Mode or explicit show:["call"]
  const showCall = phoneMode || show.includes("call");
  const bigCall = phoneMode || (showCall && isPhone);
  const has = (k: string) => show.includes(k as any);
  const website = safeUrl(lead.website);

  const share = async () => {
    const text = copyAllInfo(lead);
    try {
      if (navigator.share) {
        await navigator.share({ title: lead.business_name, text });
        return;
      }
    } catch {
      /* user cancelled */
    }
    void copy(text, "Copied for sharing");
  };

  const togglePin = async () => {
    await leadsRepo.update(lead.id, { is_pinned: !lead.is_pinned });
    toast.success(lead.is_pinned ? "Unpinned" : "Pinned");
  };

  const toggleArchive = async () => {
    await leadsRepo.update(lead.id, { is_archived: !lead.is_archived });
    toast.success(lead.is_archived ? "Restored from archive" : "Archived");
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
      {showCall && lead.phone && (
        <a href={telHref(lead.phone)} onClick={(e) => e.stopPropagation()} className={bigCall ? "flex-1 min-w-[120px]" : ""}>
          {bigCall ? (
            <Button
              variant="primary"
              className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-5 w-5" /> Call
            </Button>
          ) : (
            <ActionBtn size={size} icon={<Phone className="h-3.5 w-3.5" />} label="Call" />
          )}
        </a>
      )}
      {(has("message") || has("wa") || has("tg")) && <MessageMenu lead={lead} size={size} />}
      {!has("message") && has("wa") && lead.phone && (
        <a href={waHref(lead.phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <ActionBtn size={size} icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp" />
        </a>
      )}
      {!has("message") && has("tg") && <TelegramButton lead={lead} size={size} />}
      {has("maps") && lead.google_maps_url && (
        <a href={safeUrl(lead.google_maps_url) || ""} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <ActionBtn size={size} icon={<MapPin className="h-3.5 w-3.5" />} label="Maps" />
        </a>
      )}
      {has("web") && website && (
        <a href={website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <ActionBtn size={size} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />
        </a>
      )}
      {has("research") && <ResearchMenu lead={lead} size={size} />}
      {has("copy") && <CopyMenu lead={lead} size={size} />}
      {has("pin") && (
        <ActionBtn
          size={size}
          icon={lead.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          label={lead.is_pinned ? "Unpin" : "Pin"}
          active={lead.is_pinned}
          onClick={togglePin}
        />
      )}
      {has("archive") && (
        <ActionBtn
          size={size}
          icon={lead.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          label={lead.is_archived ? "Restore" : "Archive"}
          onClick={toggleArchive}
        />
      )}
      {has("share") && (
        <ActionBtn size={size} icon={<Share2 className="h-3.5 w-3.5" />} label="Share" onClick={share} />
      )}
      {has("more") && (
        <Dropdown
          trigger={({ toggle }) => (
            <ActionBtn
              size={size}
              icon={<MoreHorizontal className="h-3.5 w-3.5" />}
              label="More"
              onClick={(e) => {
                e.preventDefault();
                toggle();
              }}
            />
          )}
        >
          {({ close }) => (
            <>
              <MenuItem
                icon={copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                onClick={async () => {
                  await copy(crmLeadUrl(lead.id), "CRM link copied");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                  close();
                }}
              >
                Copy CRM Link
              </MenuItem>
              {onOpen && (
                <MenuItem
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => {
                    onOpen();
                    close();
                  }}
                >
                  Open profile
                </MenuItem>
              )}
              {onEdit && (
                <MenuItem
                  icon={<Search className="h-4 w-4" />}
                  onClick={() => {
                    onEdit();
                    close();
                  }}
                >
                  Edit lead
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem
                  danger
                  icon={<Archive className="h-4 w-4" />}
                  onClick={() => {
                    onDelete();
                    close();
                  }}
                >
                  Delete lead
                </MenuItem>
              )}
            </>
          )}
        </Dropdown>
      )}
    </div>
  );
}
