import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Languages, Loader2, LogOut } from "lucide-react";
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
  LANGUAGES,
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
import { useTranslation } from "react-i18next";
import { LegalDocumentModal } from "../ui/legal-document-modal";

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
  languagePreference: string;
  consentGiven: boolean;
}

const blank = (value: string | number | null | undefined) =>
  value == null ? "" : String(value);

// Keys of EditableProfile whose values are plain strings, usable with text inputs.
type TextFieldKey = {
  [K in keyof EditableProfile]: EditableProfile[K] extends string ? K : never;
}[keyof EditableProfile];

// Normalizes stored organisation states, also accepting legacy comma separated strings.
const toStateList = (value: string[] | string | null | undefined): string[] => {
  const items = Array.isArray(value) ? value : (value ?? "").split(",");
  return items.map((state) => String(state).trim()).filter(Boolean);
};

// NOTE: `fallbackLanguage` should be the app's *current* i18n language
// (pass `i18n.language` from the caller) — used only when the user record
// itself has no saved `languagePreference` yet.
const fromUser = (
  user: AuthUser,
  fallbackLanguage: string,
): EditableProfile => ({
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

  organizationState: toStateList(user.organizationState),

  organisationTypeOther: blank(user.organisationTypeOther),
  languagePreference: blank(user.languagePreference) || fallbackLanguage,
  // NOTE: `AuthUser` needs a `consentGiven?: boolean` field for this to
  // reflect whatever was recorded during initial registration.
  consentGiven: Boolean(user.consentGiven),
});

const emptyToNull = (value: string) => value.trim() || null;

/**
 * Pure, synchronous per-field validation used both for live "while typing"
 * feedback (called from onChange) and as part of the step-gating functions
 * below. Username availability (async) is handled separately via
 * `usernameStatus`, not here.
 */
function validateSingleField(
  key: keyof EditableProfile,
  value: string,
): string | undefined {
  switch (key) {
    case "name":
      return value.trim().length < 2
        ? "Please enter your full name."
        : undefined;

    case "username": {
      const username = value.trim();
      if (username.length < 3) {
        return "Username must be at least 3 characters long.";
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return "Username can contain only letters, numbers, and underscores.";
      }
      return undefined;
    }

    case "age": {
      if (!value.trim()) return "Age is required.";
      const age = Number(value);
      return !Number.isInteger(age) || age < 16 || age > 100
        ? "Age must be a whole number between 16 and 100."
        : undefined;
    }

    case "organizationName":
      return value.trim()
        ? undefined
        : "Please enter your organisation name.";

    case "organizationRole":
      return value.trim() ? undefined : "Please enter your role.";

    case "numberOfFarmers":
      if (!value.trim()) return undefined;
      return Number.isInteger(Number(value))
        ? undefined
        : "Number of farmers must be a whole number.";

    case "collegeName":
      return value.trim() ? undefined : "Please enter college name.";

    case "organisationTypeOther":
      return value.trim()
        ? undefined
        : "Please specify the organisation type.";

    case "farmSize": {
      if (!value.trim()) return "Farm size is required.";
      const size = Number(value);
      return Number.isFinite(size) && size >= 0
        ? undefined
        : "Farm size must be a positive number.";
    }

    default:
      return undefined;
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="mt-1 text-xs text-rose-600" role="alert">
      {message}
    </p>
  );
}

function LocationSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  value: string;
  options: { name: string; address?: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  error?: string;
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
      <FieldError message={error} />
    </div>
  );
}

function CropSelector({
  crops,
  onClick,
  error,
}: {
  crops: string[];
  onClick: () => void;
  error?: string;
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
      <FieldError message={error} />
    </div>
  );
}

// NOTE: verify `Parameters<typeof authApi.updateMe>[0]` includes
// `languagePreference: string` — it's sent in the payload in `save()` below.

const PROFILE_STEPS = [
  { number: 1 as const, label: "Location" },
  { number: 2 as const, label: "Details" },
  { number: 3 as const, label: "Language & Consent" },
];

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
  // Declared first so its `i18n.language` can seed the initial form below.
  const { i18n } = useTranslation();

  const initialForm = fromUser(user, i18n.language);

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
  // const [course, setCourse] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  // Step 1 = location, step 2 = details, step 3 = language.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(
    null,
  );

  // Field-level validation messages, keyed by EditableProfile field name
  // (plus "organisationTypeOther"), shown inline under each field instead
  // of via toast.
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setFieldError(field: string, message?: string) {
    setErrors((current) => {
      if (!message) {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }
      if (current[field] === message) return current;
      return { ...current, [field]: message };
    });
  }

  useEffect(() => {
    const username = form.username.trim();

    if (!username) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    if (username === originalUsername.trim()) {
      setUsernameStatus("available");
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
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
        if (response.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
          setUsernameSuggestions(response.suggestions ?? []);
        }
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
  const isStudent = category === "student";
  const navigate = useNavigate();

  // Live language preview, same idea as the registration wizard's Step4:
  // switch the whole app's language immediately on selection, and still
  // send the choice to the backend on Save. Swap `i18n.changeLanguage` for
  // the wizard's shared `setLanguage` helper here if/when it's available in
  // this file too, so both flows behave identically (localStorage + <html
  // dir/lang> sync included).
  function handleLanguageChange(value: string) {
    setForm((current) => ({ ...current, languagePreference: value }));
    setFieldError("languagePreference", undefined);
    void i18n.changeLanguage(value);
  }

  useEffect(() => {
    if (!open) return;
    const initialForm = fromUser(user, i18n.language);
    setForm(initialForm);
    setStep(1);
    setErrors({});
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
    setFieldError("state", stateName ? undefined : "Please select a state.");
    setFieldError("district", undefined);
    setFieldError("block", undefined);
    setFieldError("village", undefined);
    setFieldError("kvk", undefined);
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
    setFieldError(
      "district",
      districtName ? undefined : "Please select a district.",
    );
    setFieldError("block", undefined);
    setFieldError("village", undefined);
    setFieldError("kvk", undefined);
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
    setFieldError("block", blockName ? undefined : "Please select a block.");
    setFieldError("village", undefined);
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
    key: TextFieldKey,
    label: string,
    type = "text",
    required = false,
    numberRange?: { min?: number; max?: number },
  ) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={`profile-${key}`}>
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </Label>
      <Input
        id={`profile-${key}`}
        type={type}
        min={numberRange?.min}
        max={numberRange?.max}
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
          setFieldError(key, validateSingleField(key, value));
        }}
      />
      {key === "username" ? (
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
            <div className="space-y-1">
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                Taken. Try one of these:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {usernameSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({ ...current, username: s }))
                    }
                    className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs text-emerald-700 hover:bg-emerald-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {usernameStatus === "idle" && <FieldError message={errors.username} />}
        </>
      ) : (
        <FieldError message={errors[key]} />
      )}
    </div>
  );

  /** Validates the location step before letting the user move on to step 2. */
  function validateLocationStep(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!form.state.trim()) {
      nextErrors.state = "Please select a state.";
    }

    if (!form.district.trim()) {
      nextErrors.district = "Please select a district.";
    }

    if (category === "farmer") {
      if (!form.block.trim()) {
        nextErrors.block = "Please select a block.";
      }

      if (!form.village.trim()) {
        nextErrors.village = "Please select a village.";
      }

      if (!form.kvk.trim()) {
        nextErrors.kvk = "Please select a KVK.";
      }
    }

    setErrors((current) => {
      const next = { ...current };
      delete next.state;
      delete next.district;
      delete next.block;
      delete next.village;
      delete next.kvk;
      return { ...next, ...nextErrors };
    });

    return Object.keys(nextErrors).length === 0;
  }

  /** Validates the details step before letting the user move on to step 3. */
  function validateDetailsStep(): boolean {
    const nextErrors: Record<string, string> = {};

    if (form.name.trim().length < 2) {
      nextErrors.name = "Please enter your full name.";
    }

    const username = form.username.trim();
    if (username.length < 3) {
      nextErrors.username = "Username must be at least 3 characters long.";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      nextErrors.username =
        "Username can contain only letters, numbers, and underscores.";
    }

    if (!form.age.trim()) {
      nextErrors.age = "Age is required.";
    } else if (
      !Number.isInteger(Number(form.age)) ||
      Number(form.age) < 16 ||
      Number(form.age) > 100
    ) {
      nextErrors.age = "Age must be a whole number between 16 and 100.";
    }

    if (!form.gender.trim()) {
      nextErrors.gender = "Please select your gender.";
    }

    if (category === "farmer") {
      if (!form.farmSize.trim()) {
        nextErrors.farmSize = "Farm size is required.";
      } else if (!(Number.isFinite(Number(form.farmSize)) && Number(form.farmSize) >= 0)) {
        nextErrors.farmSize = "Farm size must be a positive number.";
      }
    }

    if ((category === "farmer" || category === "volunteer") && form.crops.length === 0) {
      nextErrors.crops = "Please select at least one crop.";
    }

    const numberOfFarmers = form.numberOfFarmers.trim()
      ? Number(form.numberOfFarmers)
      : null;
    if (numberOfFarmers !== null && !Number.isInteger(numberOfFarmers)) {
      nextErrors.numberOfFarmers = "Number of farmers must be a whole number.";
    }

    if (isOrganisationUser) {
      if (form.organizationState.length === 0) {
        nextErrors.organizationState =
          "Please select at least one operating state.";
      }

      if (!form.organisationType.trim()) {
        nextErrors.organisationType = "Please select an organisation type.";
      } else if (
        form.organisationType === OTHER_VALUE &&
        !form.organisationTypeOther.trim()
      ) {
        nextErrors.organisationTypeOther =
          "Please specify the organisation type.";
      }

      if (!form.organizationName.trim()) {
        nextErrors.organizationName = "Please enter your organisation name.";
      }

      if (!form.organizationRole.trim()) {
        nextErrors.organizationRole = "Please enter your role.";
      }
    }

    if (isStudent) {
      if (!form.courseName.trim()) {
        nextErrors.courseName = "Please select a course name.";
      }

      if (!form.collegeName.trim()) {
        nextErrors.collegeName = "Please enter college name.";
      }
    }

    setErrors((current) => {
      const next = { ...current };
      for (const key of [
        "name",
        "username",
        "age",
        "gender",
        "farmSize",
        "crops",
        "numberOfFarmers",
        "organizationState",
        "organisationType",
        "organisationTypeOther",
        "organizationName",
        "organizationRole",
        "courseName",
        "collegeName",
      ]) {
        delete next[key];
      }
      return { ...next, ...nextErrors };
    });

    // Username availability is shown live via the checking/available/taken
    // states in `field()` above rather than as a FieldError message, but it
    // should still block moving on.
    if (usernameStatus === "checking" || usernameStatus === "taken") {
      return false;
    }

    return Object.keys(nextErrors).length === 0;
  }

  /** Validates the language + consent step before letting the user save. */
  function validateLanguageStep(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!form.languagePreference) {
      nextErrors.languagePreference = "Please select a preferred language.";
    }

    if (!form.consentGiven) {
      nextErrors.consentGiven =
        "Please accept the Terms of Service and Privacy Policy to continue.";
    }

    setErrors((current) => {
      const next = { ...current };
      delete next.languagePreference;
      delete next.consentGiven;
      return { ...next, ...nextErrors };
    });

    return Object.keys(nextErrors).length === 0;
  }

  function goToDetailsStep(event: React.MouseEvent) {
    event.preventDefault();
    if (!validateLocationStep()) return;
    setStep(2);
  }

  function goToLanguageStep(event: React.MouseEvent) {
    event.preventDefault();
    if (!validateDetailsStep()) return;
    setStep(3);
  }

  function goToLocationStep(event: React.MouseEvent) {
    event.preventDefault();
    setStep(1);
  }

  function goBackToDetailsStep(event: React.MouseEvent) {
    event.preventDefault();
    setStep(2);
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    // Guards against an implicit form submission (e.g. Enter key) while not
    // yet on the final step — just advance a step instead of saving.
    if (step === 1) {
      if (validateLocationStep()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateDetailsStep()) setStep(3);
      return;
    }

    if (!validateLocationStep()) {
      setStep(1);
      return;
    }
    if (!validateDetailsStep()) {
      setStep(2);
      return;
    }
    if (!validateLanguageStep()) {
      return;
    }

    const numberOfFarmers = form.numberOfFarmers.trim()
      ? Number(form.numberOfFarmers)
      : null;

    setSaving(true);
    try {
      const payload: Parameters<typeof authApi.updateMe>[0] = {
        name: form.name.trim(),
        username: form.username.trim(),
        consentGiven: form.consentGiven,
        profileCreatedByAdminCompleted: true,
        age: form.age.trim() ? Number(form.age) : null,
        gender: emptyToNull(form.gender),
        // State and district are required database fields, so an empty editor
        // value must not overwrite an existing location with null.
        state: form.state.trim() || undefined,
        district: form.district.trim() || undefined,
        block: emptyToNull(form.block),
        village: emptyToNull(form.village),
        kvk: emptyToNull(form.kvk),
        languagePreference: form.languagePreference,
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
      if (isOrganisationUser) {
        Object.assign(payload, {
          organisationType:
            form.organisationType === OTHER_VALUE
              ? emptyToNull(form.organisationTypeOther)
              : emptyToNull(form.organisationType),
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
          className="!h-[85vh] !max-h-[85vh] !w-[85vw] !max-w-[85vw] overflow-hidden p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={save} className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-border-subtle px-5 py-4">
              <div className="flex items-start justify-between">
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

              <div className="mt-5 flex items-start">
                {PROFILE_STEPS.map((s, index) => (
                  <div key={s.number} className="contents">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          step === s.number
                            ? "bg-emerald-500 text-white"
                            : step > s.number
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-surface-variant text-text-secondary"
                        }`}
                      >
                        {s.number}
                      </div>
                      <span
                        className={`whitespace-nowrap text-xs ${
                          step === s.number
                            ? "font-semibold text-primary"
                            : "text-text-secondary"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {index < PROFILE_STEPS.length - 1 && (
                      <div
                        className={`mx-3 mt-3.5 h-px flex-1 ${
                          step > s.number
                            ? "bg-emerald-500"
                            : "bg-border-subtle"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
              {step === 1 && (
                <>
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
                      error={errors.state}
                    />
                    <LocationSelect
                      label="District"
                      value={form.district}
                      options={districts}
                      disabled={
                        loadingLocation ||
                        !form.state ||
                        districts.length === 0
                      }
                      onChange={selectDistrict}
                      placeholder="Select district"
                      required
                      error={errors.district}
                    />
                    {category === "farmer" && (
                      <LocationSelect
                        label="Block"
                        value={form.block}
                        options={blocks}
                        disabled={
                          loadingLocation ||
                          !form.district ||
                          blocks.length === 0
                        }
                        onChange={selectBlock}
                        placeholder="Select block"
                        required
                        error={errors.block}
                      />
                    )}
                    {category === "farmer" && (
                      <LocationSelect
                        label="Village"
                        value={form.village}
                        options={villages}
                        disabled={
                          loadingLocation ||
                          !form.block ||
                          villages.length === 0
                        }
                        onChange={(village) => {
                          setForm((current) => ({ ...current, village }));
                          setFieldError(
                            "village",
                            village ? undefined : "Please select a village.",
                          );
                        }}
                        placeholder="Select village"
                        required
                        error={errors.village}
                      />
                    )}
                    {category === "farmer" && (
                      <LocationSelect
                        label="KVK"
                        value={form.kvk}
                        options={kvks}
                        disabled={
                          loadingLocation ||
                          !form.district ||
                          kvks.length === 0
                        }
                        onChange={(kvk) => {
                          setForm((current) => ({ ...current, kvk }));
                          setFieldError(
                            "kvk",
                            kvk ? undefined : "Please select a KVK.",
                          );
                        }}
                        placeholder="Select KVK"
                        required
                        error={errors.kvk}
                      />
                    )}
                  </section>
                </>
              )}

              {step === 2 && (
                <>
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-primary">
                      Personal information
                    </h3>
                    {field("name", "Full name", "text", true)}
                    {field("username", "Username", "text", true)}
                    {field("age", "Age", "number", true, { min: 16, max: 100 })}
                    <div className="space-y-1.5">
                      Gender <span className="text-red-500">*</span>
                      <select
                        id="profile-gender"
                        value={form.gender}
                        disabled={Boolean(user.gender)}
                        onChange={(event) => {
                          const gender = event.target.value;
                          setForm((current) => ({ ...current, gender }));
                          setFieldError(
                            "gender",
                            gender ? undefined : "Please select your gender.",
                          );
                        }}
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
                      <FieldError message={errors.gender} />
                    </div>
                  </section>

                  {category === "farmer" && (
                    <section className="space-y-3 sm:col-span-2">
                      <h3 className="text-sm font-bold text-primary">
                        Farming
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {field("farmSize", "Farm size (acres)", "number", true, {
                          min: 0,
                        })}
                        <CropSelector
                          crops={form.crops}
                          onClick={() => setCropPickerOpen(true)}
                          error={errors.crops}
                        />
                      </div>
                    </section>
                  )}
                  {category === "student" && (
                    <section className="space-y-3 sm:col-span-2">
                      <h3 className="text-sm font-bold text-primary">
                        Education
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="course-select">
                            Course <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={form.courseName}
                            onValueChange={(value) => {
                              setForm((current) => ({
                                ...current,
                                courseName: value,
                              }));
                              setFieldError("courseName", undefined);
                            }}
                            required
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
                          <FieldError message={errors.courseName} />
                        </div>
                        {field("collegeName", "College name", "text", true)}
                        {field("universityName", "University")}
                      </div>
                    </section>
                  )}
                  {isOrganisationUser && (
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
                            onValueChange={(value) => {
                              setForm((current) => ({
                                ...current,
                                organisationType: value,
                                organisationTypeOther:
                                  value === OTHER_VALUE
                                    ? current.organisationTypeOther
                                    : "",
                              }));
                              setFieldError("organisationType", undefined);
                              if (value !== OTHER_VALUE) {
                                setFieldError(
                                  "organisationTypeOther",
                                  undefined,
                                );
                              }
                            }}
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

                              <SelectItem value={OTHER_VALUE}>
                                Other…
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError message={errors.organisationType} />

                          {form.organisationType === OTHER_VALUE && (
                            <>
                              <Input
                                className="mt-2"
                                value={form.organisationTypeOther}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setForm((current) => ({
                                    ...current,
                                    organisationTypeOther: value,
                                  }));
                                  setFieldError(
                                    "organisationTypeOther",
                                    validateSingleField(
                                      "organisationTypeOther",
                                      value,
                                    ),
                                  );
                                }}
                                placeholder="Specify organisation type"
                              />
                              <FieldError
                                message={errors.organisationTypeOther}
                              />
                            </>
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
                            { min: 0 },
                          )}
                      </div>
                    </section>
                  )}

                  {isOrganisationUser && (
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
                            onValuesChange={(values) => {
                              setForm((current) => ({
                                ...current,
                                organizationState: values,
                              }));
                              setFieldError(
                                "organizationState",
                                values.length === 0
                                  ? "Please select at least one operating state."
                                  : undefined,
                              );
                            }}
                            placeholder="Search states…"
                            helperText="Select all states where your organisation operates. You can pick more than one."
                          />
                          <FieldError message={errors.organizationState} />
                        </div>
                      </div>
                    </section>
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
                          error={errors.crops}
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
                </>
              )}

              {step === 3 && (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Languages className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-sm font-bold text-primary">
                        Preferred language
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-language">
                        Language <span className="text-rose-600">*</span>
                      </Label>
                      <Select
                        value={form.languagePreference}
                        onValueChange={handleLanguageChange}
                      >
                        <SelectTrigger id="profile-language">
                          <SelectValue placeholder="Choose language" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.code} value={l.code}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={errors.languagePreference} />
                    </div>
                  </section>

                  <section
                    className={`rounded-xl border p-3 transition-colors sm:p-4 ${
                      form.consentGiven
                        ? "border-emerald-300 bg-emerald-500/10"
                        : "border-border-subtle bg-surface-variant"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const consentGiven = !form.consentGiven;
                          setForm((current) => ({ ...current, consentGiven }));
                          setFieldError(
                            "consentGiven",
                            consentGiven
                              ? undefined
                              : "Please accept the Terms of Service and Privacy Policy to continue.",
                          );
                        }}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                          form.consentGiven
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-border-subtle bg-surface hover:border-emerald-400"
                        }`}
                      >
                        {form.consentGiven && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </button>

                      <div className="flex-1 space-y-1.5">
                        <p className="text-xs font-medium leading-snug text-foreground sm:text-sm">
                          I have read and agree to the{" "}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLegalModal("terms");
                            }}
                            className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                          >
                            Terms of Service
                          </button>{" "}
                          and{" "}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLegalModal("privacy");
                            }}
                            className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                          >
                            Privacy Policy
                          </button>
                        </p>
                      </div>
                    </div>
                    <FieldError message={errors.consentGiven} />
                  </section>
                </>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-5 py-4">
              {step === 1 && (
                <>
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
                  <Button
                    type="button"
                    onClick={goToDetailsStep}
                    className="gap-1.5"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToLocationStep}
                    disabled={saving}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToLanguageStep}
                    className="gap-1.5"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {step === 3 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBackToDetailsStep}
                    disabled={saving}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={saving} className="gap-1.5">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                    {!saving && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </form>
          <CropPickerModal
            open={cropPickerOpen}
            onOpenChange={setCropPickerOpen}
            selected={form.crops}
            onSelectionChange={(crops) => {
              setForm((current) => ({ ...current, crops }));
              setFieldError(
                "crops",
                crops.length === 0
                  ? "Please select at least one crop."
                  : undefined,
              );
            }}
          />
        </DialogContent>
      </Dialog>
      <SignOutDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
      />

            <LegalDocumentModal
              type={legalModal ?? "terms"}
              open={legalModal !== null}
              onOpenChange={(open) => !open && setLegalModal(null)}
            />

    </>
  );
}