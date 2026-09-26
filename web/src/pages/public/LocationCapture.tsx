import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { useGeolocation, type Coordinates } from "@/hooks/useGeolocation";
import { lgdApi } from "@/api/client";
import { toast } from "sonner";

export interface SubmissionLocation extends Coordinates {
  state: string;
  district: string;
  block: string;
  village: string;
}

interface LgdOption {
  code: string;
  name: string;
}

interface LocationCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: SubmissionLocation) => void;
}

export function LocationCaptureModal({ open, onOpenChange, onConfirm }: LocationCaptureModalProps) {
  const { t } = useTranslation();
  const { getCurrentPosition } = useGeolocation();

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [coordsLoading, setCoordsLoading] = useState(false);
  const [coordsError, setCoordsError] = useState<string | null>(null);

  const [states, setStates] = useState<LgdOption[]>([]);
  const [districts, setDistricts] = useState<LgdOption[]>([]);
  const [blocks, setBlocks] = useState<LgdOption[]>([]);
  const [villages, setVillages] = useState<LgdOption[]>([]);

  const [stateCode, setStateCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [blockCode, setBlockCode] = useState("");
  const [villageCode, setVillageCode] = useState("");

  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [villagesLoading, setVillagesLoading] = useState(false);

  // ─── Auto-request geolocation once, right when the modal opens ───────────
  useEffect(() => {
    if (!open) return;
    setCoordsLoading(true);
    setCoordsError(null);
    getCurrentPosition()
      .then((c) => setCoords(c))
      .catch((err) => setCoordsError(err instanceof Error ? err.message : "Could not get your location"))
      .finally(() => setCoordsLoading(false));
  }, [open, getCurrentPosition]);

  // ─── Load states once when the modal opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStatesLoading(true);
    lgdApi.getStates()
      .then((res) => setStates(res.states))
      .catch(() => toast.error("Could not load states"))
      .finally(() => setStatesLoading(false));
  }, [open]);

  // ─── Reset the whole form each time the modal is opened fresh ────────────
  useEffect(() => {
    if (!open) return;
    setStateCode(""); setDistrictCode(""); setBlockCode(""); setVillageCode("");
    setDistricts([]); setBlocks([]); setVillages([]);
  }, [open]);

  function handleStateChange(code: string) {
    setStateCode(code);
    setDistrictCode(""); setBlockCode(""); setVillageCode("");
    setDistricts([]); setBlocks([]); setVillages([]);
    setDistrictsLoading(true);
    lgdApi.getDistricts(code)
      .then((res) => setDistricts(res.districts))
      .catch(() => toast.error("Could not load districts"))
      .finally(() => setDistrictsLoading(false));
  }

  function handleDistrictChange(code: string) {
    setDistrictCode(code);
    setBlockCode(""); setVillageCode("");
    setBlocks([]); setVillages([]);
    setBlocksLoading(true);
    lgdApi.getSubDistricts(code)
      .then((res) => setBlocks(res.subdistricts))
      .catch(() => toast.error("Could not load blocks"))
      .finally(() => setBlocksLoading(false));
  }

  function handleBlockChange(code: string) {
    setBlockCode(code);
    setVillageCode("");
    setVillages([]);
    setVillagesLoading(true);
    lgdApi.getVillages(code)
      .then((res) => setVillages(res.villages))
      .catch(() => toast.error("Could not load villages"))
      .finally(() => setVillagesLoading(false));
  }

  function handleConfirm() {
    if (!coords) { toast.error("We need your location to continue — please allow location access."); return; }
    const state = states.find((s) => s.code === stateCode)?.name;
    const district = districts.find((d) => d.code === districtCode)?.name;
    const block = blocks.find((b) => b.code === blockCode)?.name;
    const village = villages.find((v) => v.code === villageCode)?.name;
    if (!state || !district || !block || !village) {
      toast.error("Please select State, District, Block, and Village");
      return;
    }
    onConfirm({ ...coords, state, district, block, village });
  }

  const canConfirm = !!coords && !!stateCode && !!districtCode && !!blockCode && !!villageCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
    className="sm:max-w-md p-6 sm:p-8 [&>button]:hidden"
    onEscapeKeyDown={(e) => e.preventDefault()}
    onPointerDownOutside={(e) => e.preventDefault()}
    onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle className="text-center">Confirm your location</DialogTitle>
          <DialogDescription className="text-center">
            We need your current location to submit this question.
          </DialogDescription>
        </DialogHeader>

        {/* Geolocation status — auto-fetched, no button */}
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
            coords
              ? "border-emerald-300 bg-emerald-50/40 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
              : coordsError
                ? "border-rose-300 bg-rose-50/40 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                : "border-border-subtle bg-surface text-text-secondary"
          }`}
        >
          {coordsLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : coords ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">
            {coordsLoading
              ? "Getting your location..."
              : coords
                ? "Location captured"
                : coordsError ?? "Waiting for location access"}
          </span>
          {coordsError && !coordsLoading && (
            <button
              type="button"
              onClick={() => {
                setCoordsLoading(true);
                setCoordsError(null);
                getCurrentPosition()
                  .then((c) => setCoords(c))
                  .catch((err) => setCoordsError(err instanceof Error ? err.message : "Could not get your location"))
                  .finally(() => setCoordsLoading(false));
              }}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          )}
        </div>

        {/* ── Cascading LGD selects ── */}
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select value={stateCode} onValueChange={handleStateChange} disabled={statesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={statesLoading ? "Loading..." : "Select state"} />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>District</Label>
            <Select
              value={districtCode}
              onValueChange={handleDistrictChange}
              disabled={!stateCode || districtsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={districtsLoading ? "Loading..." : "Select district"} />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Block</Label>
            <Select
              value={blockCode}
              onValueChange={handleBlockChange}
              disabled={!districtCode || blocksLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={blocksLoading ? "Loading..." : "Select block"} />
              </SelectTrigger>
              <SelectContent>
                {blocks.map((b) => (
                  <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Village</Label>
            <Select
              value={villageCode}
              onValueChange={setVillageCode}
              disabled={!blockCode || villagesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={villagesLoading ? "Loading..." : "Select village"} />
              </SelectTrigger>
              <SelectContent>
                {villages.map((v) => (
                  <SelectItem key={v.code} value={v.code}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-col">
  <Button className="w-full" onClick={handleConfirm} disabled={!canConfirm}>
    Confirm & Submit
  </Button>
  <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
    Cancel
  </Button>
</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}