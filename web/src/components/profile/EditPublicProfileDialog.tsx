import { useEffect, useRef, useState, type FormEvent } from "react";
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
import {
  COURSE_OPTIONS,
  ORG_TYPE_OPTIONS,
  SEASONS,
  SUPPORTED_STATES,
} from "@/constants/public";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { MultiSearchableSelect } from "../ui/multi-searchable-select";
import { OTHER_VALUE } from "./CompleteProfileWizard";

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
  organizationState: string[];
  organisationTypeOther: string;
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

  organizationState: Array.isArray(user.organizationState)
  ? user.organizationState
      .map((state) => String(state).trim())
      .filter(Boolean)
  : user.organizationState
    ? user.organizationState
        .split(",")
        .map((state: string) => state.trim())
        .filter(Boolean)
    : [],

  organisationTypeOther: blank(user.organisationTypeOther),
});

const emptyToNull = (value: string) => value.trim() || null;

function LocationSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  options: { name: string; address?: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{disabled ? "Loading options…" : placeholder}</option>
        {options.map((option) => (
          <option
            key={option.name}
            value={label === "KVK" ? option.address : option.name}
          >
            {label === "KVK" ? option.address : option.name}
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
      Primary crops <span className="text-red-500">*</span>
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
  const initialForm = fromUser(user);

  const [form, setForm] = useState<EditableProfile>(initialForm);
  const originalUsername = initialForm.username;
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

  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  useEffect(() => {
    const username = form.username.trim();

    if (username === originalUsername.trim()) {
      setUsernameStatus("available");
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");

    if (usernameTimer.current) {
      clearTimeout(usernameTimer.current);
    }

    usernameTimer.current = setTimeout(async () => {
      try {
        const response = await authApi.checkUsername(username);

        setUsernameStatus(response.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => {
      if (usernameTimer.current) {
        clearTimeout(usernameTimer.current);
      }
    };
  }, [form.username, originalUsername]);

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setLogoutConfirmOpen(true);
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
        onChange={(e) => {
          const value =
            key === "username"
              ? e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
              : e.target.value;

          setForm((prev) => ({
            ...prev,
            [key]: value,
          }));
        }}
      />
      {key === "username" && (
        <>
          {usernameStatus === "checking" && (
            <p className="text-sm text-muted-foreground">
              Checking username availability...
            </p>
          )}

          {usernameStatus === "available" && (
            <p className="text-sm text-green-600">Username is available.</p>
          )}

          {usernameStatus === "taken" && (
            <p className="text-sm text-red-600">Username is already taken.</p>
          )}
        </>
      )}
    </div>
  );

  async function save(event: FormEvent) {
    event.preventDefault();

    const name = form.name.trim();
    const username = form.username.trim();

    if (name.length < 2) {
      toast.error("Please enter your full name.");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters long.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error(
        "Username can contain only letters, numbers, and underscores.",
      );
      return;
    }

    if (usernameStatus === "checking") {
      toast.error("Please wait while we check username availability.");
      return;
    }

    if (usernameStatus === "taken") {
      toast.error("This username is already taken.");
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
    if (isOrganisationUser && form.organizationState.length === 0) {
      toast.error("Please select at least one operating state.");
      return;
    }

    if (isOrganisationUser) {
      if (!form.organisationType.trim()) {
        toast.error("Please select an organisation type.");
        return;
      }

      if (!form.organizationName.trim()) {
        toast.error("Please enter your organisation name.");
        return;
      }

      if (!form.organizationRole.trim()) {
        toast.error("Please enter your role.");
        return;
      }

      if (form.organizationState.length === 0) {
        toast.error("Please select at least one operating state.");
        return;
      }
    }

    if (isOrganisationUser) {
      if (!form.organisationType.trim()) {
        toast.error("Please select an organisation type.");
        return;
      }

      if (!form.organizationName.trim()) {
        toast.error("Please enter your organisation name.");
        return;
      }

      if (!form.organizationRole.trim()) {
        toast.error("Please enter your role.");
        return;
      }

      if (form.organizationState.length === 0) {
        toast.error("Please select at least one operating state.");
        return;
      }
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
      if (
        isOrganisationUser &&
        form.organisationType === OTHER_VALUE &&
        !form.organisationTypeOther.trim()
      ) {
        toast.error("Please specify the organisation type.");
        return;
      }
      if (isOrganisationUser) {
  Object.assign(payload, {
    organisationType: emptyToNull(form.organisationType),
    organizationName: emptyToNull(form.organizationName),
    organizationRole: emptyToNull(form.organizationRole),
    // Multi-select returns an array
    organizationState: form.organizationState,
  });
}

      if (category === "fpo" || category === "ngo")
        payload.numberOfFarmers = numberOfFarmers;
      const result = await authApi.updateMe(payload);
      onSaved(result.user);
      onOpenChange(false);
      toast.success("Profile Completed Successfully");
      navigate("/home", { replace: true });
    } catch {
      toast.error("Unable to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          // Prevent closing the modal when profile completion is required.
          if (required && !nextOpen) return;

          onOpenChange(nextOpen);
        }}
      >
        <DialogContent
          hideCloseButton
          className="!max-h-[85vh] !w-[85vw] !max-w-[85vw] overflow-hidden p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={save} className="flex max-h-[90vh] flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div>
                <DialogTitle>Complete Profile</DialogTitle>

                <p className="mt-1 text-xs text-text-secondary">
                  Complete you profile
                  {category === "fpo"
                    ? "FPO membership"
                    : (category ?? "account")}
                  .
                </p>
              </div>

              <Button
                type="button"
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </div>
            <div className=" flex flex-col gap-6 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-primary">
                  Personal information
                </h3>
                {field("name", "Full name", "text", true)}
                {field("username", "Username", "text", true)}
                {field("age", "Age", "number", true)}
                <div className="space-y-1.5">
                  Gender <span className="text-red-500">*</span>
                  <select
                    id="profile-gender"
                    value={form.gender}
                    disabled={Boolean(user.gender)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        gender: event.target.value,
                      }))
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
                <h3 className="text-sm font-bold text-primary">
                  Your location
                </h3>
                <LocationSelect
                  label="State"
                  value={form.state}
                  options={states}
                  disabled={loadingLocation || states.length === 0}
                  onChange={selectState}
                  placeholder="Select state"
                  required
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
                  required
                />
                {category === "farmer" && (
                  <LocationSelect
                    label="Block"
                    value={form.block}
                    options={blocks}
                    disabled={
                      loadingLocation || !form.district || blocks.length === 0
                    }
                    onChange={selectBlock}
                    placeholder="Select block"
                    required
                  />
                )}
                {category === "farmer" && (
                  <LocationSelect
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
                    required
                  />
                )}
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
                    required
                  />
                )}
              </section>
              {category === "farmer" && (
                <section className="space-y-3 sm:col-span-2">
                  <h3 className="text-sm font-bold text-primary">Farming</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field("farmSize", "Farm size (acres)", "text", true)}
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
                          setForm((current) => ({
                            ...current,
                            courseName: event,
                          }))
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
                    {field("collegeName", "College name", "text", true)}
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
                      <div className="space-y-1.5">
                        <Label>
                          Organisation type{" "}
                          <span className="text-rose-600">*</span>
                        </Label>

                        <Select
                          value={form.organisationType}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              organisationType: value,
                              organisationTypeOther:
                                value === OTHER_VALUE
                                  ? current.organisationTypeOther
                                  : "",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose type" />
                          </SelectTrigger>

                          <SelectContent>
                            {ORG_TYPE_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}

                            <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
                          </SelectContent>
                        </Select>

                        {form.organisationType === OTHER_VALUE && (
                          <Input
                            className="mt-2"
                            value={form.organisationTypeOther}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                organisationTypeOther: event.target.value,
                              }))
                            }
                            placeholder="Specify organisation type"
                          />
                        )}
                      </div>
                      {field(
                        "organizationName",
                        "Organisation name",
                        "text",
                        true,
                      )}
                      {field("organizationRole", "Your role", "text", true)}
                      {category !== "volunteer" &&
                        field(
                          "numberOfFarmers",
                          "Farmers / members served",
                          "number",
                          true,
                        )}
                    </div>
                  </section>

                  <section className="space-y-3 sm:col-span-2">
                    <h3 className="text-sm font-bold text-primary">
                      Organisation location
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>
                          Operating state(s){" "}
                          <span className="text-rose-600">*</span>
                        </Label>

                        <MultiSearchableSelect
                          items={SUPPORTED_STATES.map((state) => ({
                            value: state.value,
                            label: state.label,
                          }))}
                          values={form.organizationState}
                          onValuesChange={(values) =>
                            setForm((current) => ({
                              ...current,
                              organizationState: values,
                            }))
                          }
                          placeholder="Search states…"
                          helperText="Select all states where your organisation operates. You can pick more than one."
                        />
                      </div>
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
                    <div className="space-y-3">
                      {/* Season first */}
                      <div className="space-y-1.5">
                        <Label>Season</Label>
                        <Select
                          value={form.season}
                          onValueChange={(season) =>
                            setForm((current) => ({
                              ...current,
                              season,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEASONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4 h-60">
              {!required && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
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
