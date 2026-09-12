import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  authApi,
  lgdApi,
  type LgdDistrict,
  type LgdKvk,
  type LgdState,
  type LgdSubDistrict,
  type LgdVillage,
} from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CropPickerModal } from "@/components/ui/crop-picker-modal";
import type { AuthUser } from "@/types";
import { SignOutDialog } from "../SignOutDialog";
import { useNavigate } from "react-router-dom";
import { COURSE_OPTIONS } from "@/constants/public";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface EditableProfile {
  name: string;
  username: string;
  age: string;
  gender: string;
  state: string;
  district: string;
  block: string;
  village: string;
  kvk: string;
  farmSize: string;
  crops: string[];
  season: string;
  courseName: string;
  collegeName: string;
  universityName: string;
  organisationType: string;
  organizationName: string;
  organizationRole: string;
  numberOfFarmers: string;
  organizationState: string;
  organizationDistrict: string;
  organizationBlock: string;
  organizationVillage: string;
}

const blank = (value: string | number | null | undefined) =>
  value == null ? "" : String(value);
const fromUser = (user: AuthUser): EditableProfile => ({
  name: blank(user.name),
  username: blank(user.username),
  age: blank(user.age),
  gender: blank(user.gender),
  state: blank(user.state),
  district: blank(user.district),
  block: blank(user.block),
  village: blank(user.village),
  kvk: blank(user.kvk),
  farmSize: blank(user.farmSize),
  crops:
    user.cropType
      ?.split(",")
      .map((crop) => crop.trim())
      .filter(Boolean) ?? [],
  season: blank(user.season),
  courseName: blank(user.courseName),
  collegeName: blank(user.collegeName),
  universityName: blank(user.universityName),
  organisationType: blank(user.organisationType),
  organizationName: blank(user.organizationName),
  organizationRole: blank(user.organizationRole),
  numberOfFarmers: blank(user.numberOfFarmers),
  organizationState: user.organizationState?.join(", ") ?? "",
  organizationDistrict: blank(user.organizationDistrict),
  organizationBlock: blank(user.organizationBlock),
  organizationVillage: blank(user.organizationVillage),
});

const emptyToNull = (value: string) => value.trim() || null;

function LocationSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { name: string, address?: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{disabled ? "Loading options…" : placeholder}</option>
        {options.map((option) => (
          <option key={option.name} value={label === "KVK" ? option.address: option.name}>
            {label === "KVK" ? option.address: option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CropSelector({
  crops,
  onClick,
}: {
  crops: string[];
  onClick: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Crops</Label>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        className="h-10 w-full justify-start font-normal"
      >
        {crops.length
          ? `${crops.length} crop${crops.length === 1 ? "" : "s"} selected`
          : "Select crops"}
      </Button>
      {crops.length > 0 && (
        <p className="line-clamp-2 text-xs text-text-secondary">
          {crops.join(", ")}
        </p>
      )}
    </div>
  );
}

export function EditPublicProfileDialog({
  open,
  onOpenChange,
  user,
  onSaved,
  required = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
  /** Blocks dismissal while an admin-created account completes its first profile. */
  required?: boolean;
}) {
  const [form, setForm] = useState<EditableProfile>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [cropPickerOpen, setCropPickerOpen] = useState(false);
  const [states, setStates] = useState<LgdState[]>([]);
  const [districts, setDistricts] = useState<LgdDistrict[]>([]);
  const [blocks, setBlocks] = useState<LgdSubDistrict[]>([]);
  const [villages, setVillages] = useState<LgdVillage[]>([]);
  const [kvks, setKvks] = useState<LgdKvk[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [course, setCourse] = useState<string | null>(null);
  const category = user.category;
  const isOrganisationUser =
    category === "fpo" || category === "ngo" || category === "volunteer";
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const initialForm = fromUser(user);
    setForm(initialForm);
    let active = true;
    async function loadCurrentLocation() {
      setLoadingLocation(true);
      setDistricts([]);
      setBlocks([]);
      setVillages([]);
      setKvks([]);
      try {
        const stateResult = await lgdApi.getStates();
        if (!active) return;
        setStates(stateResult.states);
        const state = stateResult.states.find(
          (item) => item.name.toLowerCase() === initialForm.state.toLowerCase(),
        );
        if (!state) return;
        const districtResult = await lgdApi.getDistricts(state.code);
        if (!active) return;
        setDistricts(districtResult.districts);
        const district = districtResult.districts.find(
          (item) =>
            item.name.toLowerCase() === initialForm.district.toLowerCase(),
        );
        if (!district) return;
        const [blockResult, kvkResult] = await Promise.all([
          lgdApi.getSubDistricts(district.code),
          lgdApi.getKvks(district.code),
        ]);
        if (!active) return;
        setBlocks(blockResult.subdistricts);
        setKvks(kvkResult.kvks);
        const block = blockResult.subdistricts.find(
          (item) => item.name.toLowerCase() === initialForm.block.toLowerCase(),
        );
        if (!block) return;
        const villageResult = await lgdApi.getVillages(block.code);
        if (active) setVillages(villageResult.villages);
      } catch {
        toast.error("Unable to load location options. Please try again.");
      } finally {
        if (active) setLoadingLocation(false);
      }
    }
    void loadCurrentLocation();
    return () => {
      active = false;
    };
  }, [open, user]);

    function handleLogout() {
    setLogoutConfirmOpen(true)
  }

  async function selectState(stateName: string) {
    setForm((current) => ({
      ...current,
      state: stateName,
      district: "",
      block: "",
      village: "",
      kvk: "",
    }));
    setDistricts([]);
    setBlocks([]);
    setVillages([]);
    setKvks([]);
    const state = states.find((item) => item.name === stateName);
    if (!state) return;
    setLoadingLocation(true);
    try {
      setDistricts((await lgdApi.getDistricts(state.code)).districts);
    } catch {
      toast.error("Unable to load districts.");
    } finally {
      setLoadingLocation(false);
    }
  }

  async function selectDistrict(districtName: string) {
    setForm((current) => ({
      ...current,
      district: districtName,
      block: "",
      village: "",
      kvk: "",
    }));
    setBlocks([]);
    setVillages([]);
    setKvks([]);
    const district = districts.find((item) => item.name === districtName);
    if (!district) return;
    setLoadingLocation(true);
    try {
      const [blockResult, kvkResult] = await Promise.all([
        lgdApi.getSubDistricts(district.code),
        lgdApi.getKvks(district.code),
      ]);
      setBlocks(blockResult.subdistricts);
      setKvks(kvkResult.kvks);
    } catch {
      toast.error("Unable to load blocks and KVKs.");
    } finally {
      setLoadingLocation(false);
    }
  }

  async function selectBlock(blockName: string) {
    setForm((current) => ({ ...current, block: blockName, village: "" }));
    setVillages([]);
    const block = blocks.find((item) => item.name === blockName);
    if (!block) return;
    setLoadingLocation(true);
    try {
      setVillages((await lgdApi.getVillages(block.code)).villages);
    } catch {
      toast.error("Unable to load villages.");
    } finally {
      setLoadingLocation(false);
    }
  }
  const field = (
    key: keyof EditableProfile,
    label: string,
    type = "text",
    required = false,
  ) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={`profile-${key}`}>
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </Label>
      <Input
        id={`profile-${key}`}
        type={type}
        value={form[key]}
        required={required}
        onChange={(event) =>
          setForm((current) => ({ ...current, [key]: event.target.value }))
        }
      />
    </div>
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username.trim())) {
      toast.error("Username must be 3–30 letters, numbers, or underscores.");
      return;
    }
    if (
      form.age.trim() &&
      (!Number.isInteger(Number(form.age)) ||
        Number(form.age) < 1 ||
        Number(form.age) > 120)
    ) {
      toast.error("Please enter a valid age.");
      return;
    }
    const numberOfFarmers = form.numberOfFarmers.trim()
      ? Number(form.numberOfFarmers)
      : null;
    if (
      numberOfFarmers !== null &&
      (!Number.isInteger(numberOfFarmers) || numberOfFarmers < 1)
    ) {
      toast.error("Number of farmers must be a whole number.");
      return;
    }
    setSaving(true);
    try {
      const payload: Parameters<typeof authApi.updateMe>[0] = {
        name: form.name.trim(),
        username: form.username.trim(),
        consentGiven: required ? true : undefined,
        age: form.age.trim() ? Number(form.age) : null,
        gender: emptyToNull(form.gender),
        // State and district are required database fields, so an empty editor
        // value must not overwrite an existing location with null.
        state: form.state.trim() || undefined,
        district: form.district.trim() || undefined,
        block: emptyToNull(form.block),
        village: emptyToNull(form.village),
        kvk: emptyToNull(form.kvk),
      };
      if (category === "farmer" || category === "volunteer")
        Object.assign(payload, {
          cropType: form.crops.length ? form.crops.join(", ") : null,
          crops: form.crops,
        });
      if (category === "farmer")
        Object.assign(payload, { farmSize: emptyToNull(form.farmSize) });
      if (category === "volunteer") payload.season = emptyToNull(form.season);
      if (category === "student")
        Object.assign(payload, {
          courseName: emptyToNull(form.courseName),
          collegeName: emptyToNull(form.collegeName),
          universityName: emptyToNull(form.universityName),
        });
      if (isOrganisationUser)
        Object.assign(payload, {
          organisationType: emptyToNull(form.organisationType),
          organizationName: emptyToNull(form.organizationName),
          organizationRole: emptyToNull(form.organizationRole),
          organizationState: form.organizationState
            .split(",")
            .map((state) => state.trim())
            .filter(Boolean),
          organizationDistrict: emptyToNull(form.organizationDistrict),
          organizationBlock: emptyToNull(form.organizationBlock),
          organizationVillage: emptyToNull(form.organizationVillage),
        });
      if (category === "fpo" || category === "ngo")
        payload.numberOfFarmers = numberOfFarmers;
      const result = await authApi.updateMe(payload);
      onSaved(result.user);
      onOpenChange(false);
      toast.success("Profile Completed Successfully");
      navigate('/home', { replace: true })
    } catch {
      toast.error("Unable to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-h-[85vh] !w-[85vw] !max-w-[85vw] overflow-hidden p-0">
        <form onSubmit={save} className="flex max-h-[90vh] flex-col">
          <div className="border-b border-border-subtle px-5 py-4">
            <DialogTitle>{ "Complete your profile"}</DialogTitle>
                    <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </Button>
            <p className="mt-1 text-xs text-text-secondary">
              Update the information relevant to your{" "}
              {category === "fpo" ? "FPO membership" : (category ?? "account")}.
            </p>
          </div>
          <div className=" flex flex-col gap-6 overflow-y-auto px-5 py-5">
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-primary">
                Personal information
              </h3>
              {field("name", "Full name", "text", true)}
              {field("username", "Username", "text", true)}
              {field("age", "Age", "number")}
              <div className="space-y-1.5">
                <Label htmlFor="profile-gender">Gender</Label>
                <select
                  id="profile-gender"
                  value={form.gender}
                  disabled={Boolean(user.gender)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, gender: event.target.value }))
                  }
                  className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 text-sm disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {user.gender ? (
                    <option value={form.gender}>{form.gender}</option>
                  ) : (
                    <>
                      <option value="">Select gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-primary">Your location</h3>
              <LocationSelect
                label="State"
                value={form.state}
                options={states}
                disabled={loadingLocation || states.length === 0}
                onChange={selectState}
                placeholder="Select state"
              />
              <LocationSelect
                label="District"
                value={form.district}
                options={districts}
                disabled={
                  loadingLocation || !form.state || districts.length === 0
                }
                onChange={selectDistrict}
                placeholder="Select district"
              />
              {category === "farmer" && <LocationSelect
                label="Block"
                value={form.block}
                options={blocks}
                disabled={
                  loadingLocation || !form.district || blocks.length === 0
                }
                onChange={selectBlock}
                placeholder="Select block"
              />}
              {category === "farmer" &&<LocationSelect
                label="Village"
                value={form.village}
                options={villages}
                disabled={
                  loadingLocation || !form.block || villages.length === 0
                }
                onChange={(village) =>
                  setForm((current) => ({ ...current, village }))
                }
                placeholder="Select village"
              />}
              {category === "farmer" && (
                <LocationSelect
                  label="KVK"
                  value={form.kvk}
                  options={kvks}
                  disabled={
                    loadingLocation || !form.district || kvks.length === 0
                  }
                  onChange={(kvk) =>
                    setForm((current) => ({ ...current, kvk }))
                  }
                  placeholder="Select KVK"
                />
              )}
            </section>
            {category === "farmer" && (
              <section className="space-y-3 sm:col-span-2">
                <h3 className="text-sm font-bold text-primary">Farming</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("farmSize", "Farm size (acres)")}
                  <CropSelector
                    crops={form.crops}
                    onClick={() => setCropPickerOpen(true)}
                  />
                </div>
              </section>
            )}
            {category === "student" && (
              <section className="space-y-3 sm:col-span-2">
                <h3 className="text-sm font-bold text-primary">Education</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                  <Label htmlFor="course-select">Course</Label>
                  <Select
              value={form.courseName}
              onValueChange={(event) =>
                    setForm((current) => ({ ...current, courseName: event }))
                  }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose course" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
                  {field("collegeName", "College")}
                  {field("universityName", "University")}
                </div>
              </section>
            )}
            {isOrganisationUser && (
              <>
                <section className="space-y-3 sm:col-span-2">
                  <h3 className="text-sm font-bold text-primary">
                    Organisation
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field("organisationType", "Organisation type")}
                    {field("organizationName", "Organisation name")}
                    {field("organizationRole", "Your role")}
                    {category !== "volunteer" &&
                      field(
                        "numberOfFarmers",
                        "Farmers / members served",
                        "number",
                      )}
                  </div>
                </section>

                <section className="space-y-3 sm:col-span-2">
                  <h3 className="text-sm font-bold text-primary">
                    Organisation location
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field(
                      "organizationState",
                      "States served (comma separated)",
                    )}
                    {field("organizationDistrict", "District")}
                    {field("organizationBlock", "Block")}
                    {field("organizationVillage", "Village")}
                  </div>
                </section>
              </>
            )}

            {category === "volunteer" && (
              <section className="space-y-3 sm:col-span-2">
                <h3 className="text-sm font-bold text-primary">
                  Agriculture focus
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CropSelector
                    crops={form.crops}
                    onClick={() => setCropPickerOpen(true)}
                  />
                  {field("season", "Season")}
                </div>
              </section>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4 h-60">
            {!required && <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save
              changes
            </Button>
          </div>
        </form>
        <CropPickerModal
          open={cropPickerOpen}
          onOpenChange={setCropPickerOpen}
          selected={form.crops}
          onSelectionChange={(crops) =>
            setForm((current) => ({ ...current, crops }))
          }
        />
      </DialogContent>
    </Dialog>
          <SignOutDialog
            open={logoutConfirmOpen}
            onOpenChange={setLogoutConfirmOpen}
          />
    </>
  );
}
