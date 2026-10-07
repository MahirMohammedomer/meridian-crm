import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  X,
  Archive,
  ArchiveRestore,
  Trash2,
  Plus,
  Pencil,
  Check,
  Phone,
  Mail,
  Globe,
  MapPin,
  Link2,
  ExternalLink,
  FileText,
  Clock,
  ClipboardCopy,
  Sparkles,
} from "lucide-react";
import { WebsiteBriefDialog } from "@/components/leads/WebsiteBriefDialog";
import { db, markRecentlyViewed } from "@/lib/db";
import {
  activitiesRepo,
  contactsRepo,
  followupsRepo,
  leadsRepo,
  notesRepo,
  paymentsRepo,
  projectsRepo,
} from "@/lib/repos";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Drawer,
  Dropdown,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  NativeSelect,
  Progress,
  SectionTitle,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui/ui";
import { QuickActions } from "@/components/common/QuickActions";
import { PinButton, ScoreChip, StatusSelect, TierBadge, WebsiteCell } from "./controls";
import {
  ACTIVITY_TYPES,
  LEAD_STATUSES,
  PROJECT_STAGES,
  type ActivityType,
  type ContactRole,
  type Lead,
  type LeadNote,
  type LeadActivity,
  type FollowUp,
  type Contact,
  type Project,
  type Payment,
  type Tier,
  type ResearchStatus,
} from "@/lib/types";
import {
  addDays,
  copyAllInfo,
  copyText,
  dueLabel,
  formatDate,
  formatETB,
  safeUrl,
  timeAgo,
  toLocalInputValue,
  STAGE_STYLES,
} from "@/lib/utils";
import { TiktokIcon, FacebookIcon, InstagramIcon, LinkedinIcon, TelegramIcon } from "@/components/ui/socials";
import { useApp } from "@/lib/app";

export function LeadProfile({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);


  const lead = useLiveQuery<Lead | undefined>(async () => (leadId ? db.leads.get(leadId) : undefined), [leadId]);
  const notes = useLiveQuery<LeadNote[] | undefined>(async () => (leadId ? db.lead_notes.where("lead_id").equals(leadId).reverse().sortBy("created_at") : []), [leadId]);
  const activities = useLiveQuery<LeadActivity[] | undefined>(async () => (leadId ? db.lead_activities.where("lead_id").equals(leadId).reverse().sortBy("created_at") : []), [leadId]);
  const followups = useLiveQuery<FollowUp[] | undefined>(async () => (leadId ? db.follow_ups.where("lead_id").equals(leadId).sortBy("due_date") : []), [leadId]);
  const contacts = useLiveQuery<Contact[] | undefined>(async () => (leadId ? db.contacts.where("lead_id").equals(leadId).toArray() : []), [leadId]);
  const projects = useLiveQuery<Project[] | undefined>(async () => (leadId ? db.projects.where("client_lead_id").equals(leadId).toArray() : []), [leadId]);
  const payments = useLiveQuery<Payment[] | undefined>(async () => (leadId ? db.payments.where("lead_id").equals(leadId).reverse().sortBy("date") : []), [leadId]);

  if (!leadId) return null;

  if (lead) void markRecentlyViewed(lead.id);

  if (!lead) {
    return (
      <Drawer open onClose={onClose} header={null}>
        <div className="p-8 text-center text-sm text-slate-500">Lead not found.</div>
      </Drawer>
    );
  }

  const header = (
    <div className="shrink-0 border-b border-slate-200 px-5 pb-3 pt-4 dark:border-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {lead.business_name || "(unnamed)"}
            </h2>
            <PinButton lead={lead} />
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-slate-500 dark:text-slate-400">
            {[lead.category, lead.city || lead.address].filter(Boolean).join(" · ") || "No category"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TierBadge lead={lead} />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Score <ScoreChip lead={lead} className="p-0 hover:bg-transparent dark:hover:bg-transparent" />
            </span>
            <StatusSelect lead={lead} />
            <WebsiteCell lead={lead} />
            {lead.rating ? (
              <Badge className="bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-400">
                ⭐ {lead.rating} {lead.reviews_count ? `· ${lead.reviews_count}` : ""}
              </Badge>
            ) : null}
            {lead.is_archived && <Badge className="bg-slate-500/12 text-slate-500">Archived</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Dropdown
            trigger={({ toggle }) => (
              <Button variant="ghost" size="icon-sm" onClick={toggle} title="More">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <circle cx="12" cy="5" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="12" cy="19" r="1.7" />
                </svg>
              </Button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem
                  icon={<ClipboardCopy className="h-4 w-4" />}
                  onClick={() => {
                    setBriefPrototypeUrl(lead.custom_fields?.prototype_url || "");
                    setBriefOpen(true);
                    close();
                  }}
                >
                  Copy website brief
                </MenuItem>
                <MenuItem
                  icon={<Link2 className="h-4 w-4" />}
                  onClick={async () => {
                    const path = (location.pathname || "/").replace(/\/$/, "") || "";
                    await copyText(`${location.origin}${path}/#/leads/${lead.id}`);
                    toast.success("CRM link copied");
                    close();
                  }}
                >
                  Copy CRM link
                </MenuItem>
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => {
                    setEditOpen(true);
                    close();
                  }}
                >
                  Edit business info
                </MenuItem>
                <MenuItem
                  icon={lead.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  onClick={async () => {
                    await leadsRepo.update(lead.id, { is_archived: !lead.is_archived });
                    toast.success(lead.is_archived ? "Restored" : "Archived");
                    close();
                  }}
                >
                  {lead.is_archived ? "Restore from archive" : "Archive lead"}
                </MenuItem>
                <MenuItem
                  danger
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    setConfirmDelete(true);
                    close();
                  }}
                >
                  Delete lead
                </MenuItem>
              </>
            )}
          </Dropdown>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <QuickActions
          lead={lead}
          size="sm"
          show={["message", "research", "copy", "pin"]}
          onEdit={() => setEditOpen(true)}
        />
        <Button
          size="sm"
          variant="secondary"
          title="Copy Arena / website build prompt"
          onClick={() => setBriefOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Website brief
        </Button>
      </div>
      {(lead.custom_fields?.last_brief_copied_at || lead.custom_fields?.prototype_url) && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          {lead.custom_fields?.last_brief_copied_at
            ? `Brief copied ${timeAgo(lead.custom_fields.last_brief_copied_at)}`
            : null}
          {lead.custom_fields?.prototype_url ? (
            <>
              {lead.custom_fields?.last_brief_copied_at ? " · " : ""}
              <a
                href={safeUrl(lead.custom_fields.prototype_url) || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 underline-offset-2 hover:underline dark:text-slate-300"
              >
                Prototype link
              </a>
            </>
          ) : null}
        </p>
      )}

      <div className="mt-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "contacts", label: `Contacts` },
            { value: "notes", label: `Notes` },
            { value: "activity", label: `Activity` },
            { value: "followups", label: `Follow-ups` },
            { value: "projects", label: `Projects` },
            { value: "payments", label: `Payments` },
          ]}
        />
      </div>
    </div>
  );

  return (
    <>
      <Drawer open onClose={onClose} header={header} width="max-w-2xl">
        <div className="px-5 pb-24 pt-4">
          {tab === "overview" && <OverviewTab lead={lead} />}
          {tab === "contacts" && <ContactsTab lead={lead} contacts={contacts || []} />}
          {tab === "notes" && <NotesTab lead={lead} notes={notes || []} />}
          {tab === "activity" && <ActivityTab lead={lead} activities={activities || []} />}
          {tab === "followups" && <FollowupsTab lead={lead} followups={followups || []} />}
          {tab === "projects" && <ProjectsTab lead={lead} projects={projects || []} />}
          {tab === "payments" && (
            <PaymentsTab lead={lead} projects={projects || []} payments={payments || []} />
          )}
        </div>
      </Drawer>

      <EditLeadDialog open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />

      <WebsiteBriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} lead={lead} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${lead.business_name || "lead"}?`}
        message="This permanently deletes the lead and all of its notes, activities and follow-ups from this device."
        onConfirm={async () => {
          await leadsRepo.remove(lead.id);
          toast.success("Lead deleted");
          onClose();
        }}
      />
    </>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewTab({ lead }: { lead: Lead }) {
  const [tag, setTag] = useState("");
  const [cfKey, setCfKey] = useState("");
  const [cfVal, setCfVal] = useState("");

  const set = (c: Partial<Lead>) => leadsRepo.update(lead.id, c);
  const cf = lead.custom_fields || {};

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle>Business info</SectionTitle>
        <div className="mt-3 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
          <InfoRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, "")}` : undefined} icon={<Phone className="h-3.5 w-3.5" />} />
          <InfoRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} icon={<Mail className="h-3.5 w-3.5" />} />
          <InfoRow label="Address" value={lead.address || lead.city} />
          <InfoRow label="City" value={lead.city} />
          <InfoRow label="Website" value={lead.website} href={safeUrl(lead.website)} icon={<Globe className="h-3.5 w-3.5" />} external />
          <InfoRow label="Google Maps" value={lead.google_maps_url} href={safeUrl(lead.google_maps_url)} icon={<MapPin className="h-3.5 w-3.5" />} external />
          <InfoRow label="Rating" value={lead.rating ? `${lead.rating} ★ (${lead.reviews_count ?? 0} reviews)` : ""} />
          <InfoRow label="Added" value={formatDate(lead.created_at)} />
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/5">
          <SectionTitle>Social</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SocialPill href={lead.facebook_url} icon={<FacebookIcon />} label="Facebook" />
            <SocialPill href={lead.instagram_url} icon={<InstagramIcon />} label="Instagram" />
            <SocialPill href={lead.tiktok_url} icon={<TiktokIcon />} label="TikTok" />
            <SocialPill href={lead.linkedin_url} icon={<LinkedinIcon />} label="LinkedIn" />
            <SocialPill href={lead.telegram_url} icon={<TelegramIcon />} label="Telegram" />
            {lead.telegram_username && (
              <a
                href={`https://t.me/${lead.telegram_username.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
              >
                <TelegramIcon /> @{lead.telegram_username.replace(/^@/, "")}
              </a>
            )}
            {!lead.facebook_url &&
              !lead.instagram_url &&
              !lead.tiktok_url &&
              !lead.linkedin_url &&
              !lead.telegram_url &&
              !lead.telegram_username && <span className="text-[12px] text-slate-400">No social profiles</span>}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Lead priority — manual only</SectionTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Score (0–100)">
            <Input
              type="number"
              min={0}
              max={100}
              defaultValue={lead.lead_score}
              key={`score-${lead.lead_score}`}
              onBlur={(e) => set({ lead_score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="Tier">
            <NativeSelect
              value={String(lead.tier)}
              onChange={(e) => set({ tier: Number(e.target.value) as Tier })}
            >
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                  {t === 1 ? " · Highest" : t === 5 ? " · Lowest" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Potential value (ETB)">
            <Input
              type="number"
              defaultValue={lead.potential_value ?? ""}
              key={`pv-${lead.potential_value}`}
              onBlur={(e) => set({ potential_value: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Next action">
            <Input
              defaultValue={lead.next_action}
              key={`na-${lead.next_action}`}
              placeholder="Call owner Friday"
              onBlur={(e) => set({ next_action: e.target.value })}
            />
          </Field>
          <Field label="Research status">
            <NativeSelect
              value={lead.research_status}
              onChange={(e) => set({ research_status: e.target.value as ResearchStatus })}
            >
              {["Not Researched", "Researching", "Researched"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Why scored (your reasoning)">
            <Textarea
              defaultValue={lead.why_scored}
              key={`ws-${lead.why_scored}`}
              rows={2}
              placeholder="4.8 rating, 200+ reviews, no website, high-end branding"
              onBlur={(e) => set({ why_scored: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Tags</SectionTitle>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(lead.tags || []).map((t) => (
            <span
              key={t}
              className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"
            >
              {t}
              <button
                onClick={async () => set({ tags: (lead.tags || []).filter((x) => x !== t) })}
                className="opacity-40 transition group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!lead.tags?.length && <span className="text-[12px] text-slate-400">No tags</span>}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Add tag…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && tag.trim()) {
                set({ tags: Array.from(new Set([...(lead.tags || []), tag.trim()])) });
                setTag("");
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!tag.trim()) return;
              set({ tags: Array.from(new Set([...(lead.tags || []), tag.trim()])) });
              setTag("");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Custom fields</SectionTitle>
        <div className="mt-2.5 space-y-1.5">
          {Object.entries(cf).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] dark:bg-white/5">
              <span className="font-medium text-slate-600 dark:text-slate-300">{k}</span>
              <span className="flex-1 truncate text-slate-500 dark:text-slate-400">{v}</span>
              <button
                onClick={() => {
                  const next = { ...cf };
                  delete next[k];
                  set({ custom_fields: next });
                }}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {!Object.keys(cf).length && <p className="text-[12px] text-slate-400">No custom fields</p>}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Input value={cfKey} onChange={(e) => setCfKey(e.target.value)} placeholder="Field name" />
          <Input value={cfVal} onChange={(e) => setCfVal(e.target.value)} placeholder="Value" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!cfKey.trim()) return;
              set({ custom_fields: { ...cf, [cfKey.trim()]: cfVal } });
              setCfKey("");
              setCfVal("");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Timeline</SectionTitle>
        <div className="mt-2.5 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Last contacted</div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-200">
              {lead.last_contacted_at ? `${timeAgo(lead.last_contacted_at)} · ${formatDate(lead.last_contacted_at)}` : "Never"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Next follow-up</div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-200">
              {lead.next_followup_at ? dueLabel(lead.next_followup_at) : "None scheduled"}
            </div>
          </div>
        </div>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          const ok = await copyText(copyAllInfo(lead));
          ok ? toast.success("All info copied") : toast.error("Copy failed");
        }}
      >
        <FileText className="h-4 w-4" /> Copy All Info
      </Button>
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
  icon,
  external,
}: {
  label: string;
  value?: string | null;
  href?: string | null;
  icon?: React.ReactNode;
  external?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {value ? (
        href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1.5 truncate text-[13px] text-slate-700 hover:underline dark:text-slate-200"
          >
            {icon}
            <span className="truncate">{value}</span>
            {external && <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />}
          </a>
        ) : (
          <div className="mt-0.5 truncate text-[13px] text-slate-700 dark:text-slate-200">{value}</div>
        )
      ) : (
        <div className="mt-0.5 text-[13px] text-slate-300 dark:text-slate-600">—</div>
      )}
    </div>
  );
}

function SocialPill({ href, icon, label }: { href?: string; icon: React.ReactNode; label: string }) {
  const url = safeUrl(href);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[12px] text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
    >
      {icon} {label}
    </a>
  );
}

/* ------------------------------ Contacts ------------------------------ */

function ContactsTab({ lead, contacts }: { lead: Lead; contacts: any[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", role: "Owner", phone: "", email: "", is_primary: false });

  const startAdd = () => {
    setEditing(null);
    setForm({ name: "", role: "Owner", phone: "", email: "", is_primary: contacts.length === 0 });
    setOpen(true);
  };
  const startEdit = (c: any) => {
    setEditing(c);
    setForm({ ...c });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (editing) await contactsRepo.update(editing.id, form);
    else await contactsRepo.create({ ...form, lead_id: lead.id });
    toast.success(editing ? "Contact updated" : "Contact added");
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>People at {lead.business_name || "this business"}</SectionTitle>
        <Button size="sm" variant="secondary" onClick={startAdd}>
          <Plus className="h-3.5 w-3.5" /> Add contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">No contacts yet. Add the owner or manager.</Card>
      ) : (
        contacts.map((c) => (
          <Card key={c.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-slate-900 dark:text-white">{c.name}</span>
                  <Badge>{c.role}</Badge>
                  {c.is_primary && (
                    <Badge className="bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-[12.5px] text-slate-500 dark:text-slate-400">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                      📞 {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="hover:underline">
                      ✉️ {c.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {c.phone && (
                  <a href={`https://wa.me/${c.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
                    <Button size="icon-sm" variant="ghost" title="WhatsApp">
                      <span className="text-[13px]">💬</span>
                    </Button>
                  </a>
                )}
                <Button size="icon-sm" variant="ghost" onClick={() => startEdit(c)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={async () => {
                    await contactsRepo.remove(c.id);
                    toast.success("Contact removed");
                  }}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit contact" : "Add contact"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Role">
            <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ContactRole })}>
              {["Owner", "Manager", "Marketing", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            Primary contact
          </label>
        </div>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Notes -------------------------------- */

function NotesTab({ lead, notes }: { lead: Lead; notes: any[] }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editText, setEditText] = useState("");

  return (
    <div className="space-y-3">
      <Card className="p-3.5">
        <SectionTitle>Add note</SectionTitle>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Owner interested but wants to see a portfolio first…"
          className="mt-2"
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              if (!text.trim()) return;
              await notesRepo.create(lead.id, text.trim());
              setText("");
              toast.success("Note saved locally");
            }}
          >
            Save note
          </Button>
        </div>
      </Card>

      {notes.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">No notes yet.</Card>
      ) : (
        <div className="relative space-y-3 pl-4">
          <div className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-200 dark:bg-white/10" />
          {notes.map((n) => (
            <div key={n.id} className="relative">
              <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white dark:bg-white/30 dark:ring-[#0f1115]" />
              <Card className="p-3.5">
                {editing === n.id ? (
                  <div>
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          await notesRepo.update(n.id, editText);
                          setEditing(null);
                          toast.success("Note updated");
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                      {n.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{formatDate(n.created_at)} · {timeAgo(n.created_at)}</span>
                      <div className="flex gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setEditing(n.id);
                            setEditText(n.content);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            await notesRepo.remove(n.id);
                            toast.success("Note deleted");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Activity ------------------------------ */

function ActivityTab({ lead, activities }: { lead: Lead; activities: any[] }) {
  const [type, setType] = useState<ActivityType>("Call");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(toLocalInputValue(new Date().toISOString()));

  return (
    <div className="space-y-3">
      <Card className="p-3.5">
        <SectionTitle>Log activity</SectionTitle>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </NativeSelect>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Called owner — interested, sent portfolio via WhatsApp"
          className="mt-2"
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              if (!content.trim()) return;
              await activitiesRepo.create(lead.id, type, content.trim(), date ? new Date(date).toISOString() : undefined);
              setContent("");
              toast.success("Activity logged");
            }}
          >
            Log activity
          </Button>
        </div>
      </Card>

      {activities.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">No activity yet.</Card>
      ) : (
        <div className="relative space-y-2.5 pl-4">
          <div className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-200 dark:bg-white/10" />
          {activities.map((a) => (
            <div key={a.id} className="relative flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
              <span className="absolute -left-4 top-3 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-white dark:ring-[#0f1115]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge>{a.type}</Badge>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(a.created_at)} · {timeAgo(a.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-700 dark:text-slate-200">{a.content}</p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={async () => {
                  await activitiesRepo.remove(a.id);
                  toast.success("Activity removed");
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Follow-ups ----------------------------- */

function FollowupsTab({ lead, followups }: { lead: Lead; followups: any[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Follow up with ${lead.business_name || "lead"}`);
  const [due, setDue] = useState(toLocalInputValue(addDays(new Date(), 1).toISOString()));
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Follow-ups</SectionTitle>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {followups.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">No follow-ups scheduled.</Card>
      ) : (
        followups.map((f) => {
          const overdue = f.status !== "Done" && f.status !== "Cancelled" && new Date(f.due_date) < new Date();
          return (
            <Card key={f.id} className={`p-3.5 ${f.status === "Done" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">{f.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className={overdue ? "font-medium text-red-500" : "text-slate-500 dark:text-slate-400"}>
                      <Clock className="mr-1 inline h-3 w-3" />
                      {dueLabel(f.due_date)}
                    </span>
                    <Badge
                      className={
                        f.status === "Done"
                          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                          : overdue
                            ? "bg-red-500/12 text-red-600 dark:text-red-400"
                            : ""
                      }
                    >
                      {f.status === "Pending" && overdue ? "Overdue" : f.status}
                    </Badge>
                  </div>
                  {f.notes && <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">{f.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {f.status !== "Done" && (
                    <Button
                      size="xs"
                      variant="success"
                      onClick={async () => {
                        await followupsRepo.complete(f.id);
                        toast.success("Follow-up done");
                      }}
                    >
                      <Check className="h-3 w-3" /> Done
                    </Button>
                  )}
                  <Dropdown
                    trigger={({ toggle }) => (
                      <Button size="xs" variant="outline" onClick={toggle}>
                        Reschedule
                      </Button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        <MenuLabel>Reschedule</MenuLabel>
                        {[
                          { label: "Tomorrow", days: 1 },
                          { label: "In 3 days", days: 3 },
                          { label: "Next week", days: 7 },
                        ].map((o) => (
                          <MenuItem
                            key={o.label}
                            onClick={async () => {
                              await followupsRepo.update(f.id, {
                                due_date: addDays(new Date(), o.days).toISOString(),
                                status: "Pending",
                              });
                              toast.success(`Rescheduled to ${o.label.toLowerCase()}`);
                              close();
                            }}
                          >
                            {o.label}
                          </MenuItem>
                        ))}
                        <MenuItem
                          danger
                          onClick={async () => {
                            await followupsRepo.update(f.id, { status: "Cancelled" });
                            close();
                          }}
                        >
                          Cancel follow-up
                        </MenuItem>
                      </>
                    )}
                  </Dropdown>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={async () => {
                      await followupsRepo.remove(f.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New follow-up"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await followupsRepo.create({ lead_id: lead.id, title, due_date: new Date(due).toISOString(), notes });
                toast.success("Follow-up created");
                setOpen(false);
                setNotes("");
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "Next week", days: 7 },
            ].map((o) => (
              <Button
                key={o.label}
                size="xs"
                variant="outline"
                onClick={() => setDue(toLocalInputValue(addDays(new Date(), o.days).toISOString()))}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Projects ------------------------------ */

function ProjectsTab({ lead, projects }: { lead: Lead; projects: any[] }) {
  const { openProject } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", stage: "Planning", value: lead.potential_value || 35000 });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Projects</SectionTitle>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setForm({ name: `${lead.business_name || "Client"} Website`, stage: "Planning", value: lead.potential_value || 35000 });
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Create project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">
          No projects yet. Mark this lead as Won to turn it into a client project.
        </Card>
      ) : (
        projects.map((p) => (
          <Card key={p.id} className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{p.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={STAGE_STYLES[p.stage]}>{p.stage}</Badge>
                  <span className="text-[12px] text-slate-500">{p.progress}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{formatETB(p.value)}</div>
                <div className="text-[11px] text-slate-400">Paid {formatETB(p.paid)}</div>
              </div>
            </div>
            <Progress value={p.progress} className="mt-2.5" />
          </Card>
        ))
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!form.name.trim()) return toast.error("Name required");
                const created = await projectsRepo.create({ ...form, client_lead_id: lead.id });
                if (lead.status !== "Won") await leadsRepo.update(lead.id, { status: "Won" });
                toast.success("Project created");
                setOpen(false);
                setForm({ name: "", stage: "Planning", value: lead.potential_value || 35000 });
                openProject(created.id);
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Project name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website redesign" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <NativeSelect value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {PROJECT_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Value (ETB)">
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Payments ------------------------------ */

function PaymentsTab({ lead, projects, payments }: { lead: Lead; projects: any[]; payments: any[] }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toLocalInputValue(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");

  const totalValue = projects.reduce((s, p) => s + (p.value || 0), 0);
  const totalPaid = projects.reduce((s, p) => s + (p.paid || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Value", val: formatETB(totalValue) },
          { label: "Paid", val: formatETB(totalPaid), color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Remaining", val: formatETB(totalValue - totalPaid), color: "text-amber-600 dark:text-amber-400" },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-[15px] font-semibold ${s.color || "text-slate-900 dark:text-white"}`}>{s.val}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <SectionTitle>Payment history</SectionTitle>
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add payment
        </Button>
      </div>

      {payments.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-slate-400">No payments recorded.</Card>
      ) : (
        payments.map((p) => (
          <Card key={p.id} className="flex items-center justify-between p-3">
            <div>
              <div className="text-[13.5px] font-semibold text-emerald-600 dark:text-emerald-400">{formatETB(p.amount)}</div>
              <div className="text-[11.5px] text-slate-400">
                {formatDate(p.date)} {p.notes ? `· ${p.notes}` : ""}
              </div>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={async () => {
                await paymentsRepo.remove(p.id);
                toast.success("Payment removed");
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </Card>
        ))
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record payment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!amount || Number(amount) <= 0) return toast.error("Enter an amount");
                await paymentsRepo.create({
                  lead_id: lead.id,
                  project_id: projectId || undefined,
                  amount: Number(amount),
                  date: new Date(date).toISOString(),
                  notes,
                });
                toast.success("Payment recorded");
                setOpen(false);
                setAmount("");
                setNotes("");
              }}
            >
              Record
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Amount (ETB)">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date.slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {projects.length > 0 && (
            <Field label="Project">
              <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— none —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="50% advance via bank transfer" />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Edit dialog ---------------------------- */

function EditLeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  const [form, setForm] = useState<any>({ ...lead });
  const fields: { key: keyof Lead; label: string }[] = [
    { key: "business_name", label: "Business name" },
    { key: "category", label: "Category / niche" },
    { key: "address", label: "Address" },
    { key: "city", label: "City / subcity" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "website", label: "Website" },
    { key: "google_maps_url", label: "Google Maps URL" },
    { key: "facebook_url", label: "Facebook" },
    { key: "instagram_url", label: "Instagram" },
    { key: "tiktok_url", label: "TikTok" },
    { key: "telegram_username", label: "Telegram username" },
    { key: "linkedin_url", label: "LinkedIn" },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit business info"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await leadsRepo.update(lead.id, {
                ...form,
                website_status: form.website ? "has_website" : "no_website",
              });
              toast.success("Lead updated");
              onClose();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={String(f.key)} label={f.label}>
            <Input value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Rating">
          <Input type="number" step="0.1" value={form.rating ?? ""} onChange={(e) => setForm({ ...form, rating: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Reviews count">
          <Input type="number" value={form.reviews_count ?? ""} onChange={(e) => setForm({ ...form, reviews_count: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Status">
          <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </Dialog>
  );
}
