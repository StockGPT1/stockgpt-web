"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ElasticBubble } from "@/components/native-navigation/LiquidControls";
import { StockIcon } from "@/components/StockIcon";
import { nativeHaptic } from "@/lib/ios-native";
import styles from "./ProfileWorkspace.module.css";

export type ProfileDetails = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  memberSince?: string | null;
};

type PhotoDraft = { url: string; blob: Blob | null };
type PhotoOperation = "preparing" | "saving" | "removing" | null;
type Feedback = { kind: "success" | "error"; text: string } | null;

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 80;

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] || email || "S").slice(0, 2)).toUpperCase();
}

function memberDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function preparePhoto(sourceUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const source = new window.Image();
    source.onload = () => resolve(source);
    source.onerror = () => reject(new Error("This photo couldn’t be opened. Try a JPG, PNG or WebP image."));
    source.src = sourceUrl;
  });
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (side < 1) throw new Error("This photo couldn’t be opened. Please choose another image.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(384, side);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This photo couldn’t be prepared. Please try again.");
  context.fillStyle = "#0b2d1f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("This photo is too large. Please choose another image.");
  return blob;
}

async function profileResponse(response: Response): Promise<ProfileDetails> {
  const body = await response.json().catch(() => null) as { profile?: ProfileDetails; error?: string } | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Sign in again to save your profile.");
    throw new Error(typeof body?.error === "string" ? body.error : "Your changes couldn’t be saved. Please try again.");
  }
  const profile = body?.profile;
  if (!profile || typeof profile.displayName !== "string" || typeof profile.email !== "string" || !(profile.avatarUrl === null || typeof profile.avatarUrl === "string")) {
    throw new Error("Your profile couldn’t be refreshed. Please reload the page.");
  }
  return profile;
}

export function ProfileWorkspace({ initialProfile }: { initialProfile: ProfileDetails }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoOperation, setPhotoOperation] = useState<PhotoOperation>(null);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoGeneration = useRef(0);
  const busy = savingName || photoOperation !== null;
  const photoUrl = photoDraft?.url ?? profile.avatarUrl;
  const showImage = Boolean(photoUrl && photoUrl !== failedImage);
  const joined = memberDate(profile.memberSince);
  const nameChanged = displayName.trim() !== profile.displayName;

  useEffect(() => {
    const url = photoDraft?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photoDraft?.url]);

  useEffect(() => () => { photoGeneration.current += 1; }, []);

  function saved(next: ProfileDetails, syncName = false) {
    setProfile(next);
    if (syncName) setDisplayName(next.displayName);
    window.dispatchEvent(new CustomEvent("stockgpt:profile-updated", { detail: next }));
    nativeHaptic("success");
    router.refresh();
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedback(null);
    if ((file.type && !file.type.startsWith("image/")) || file.size > MAX_SOURCE_BYTES) {
      setFeedback({ kind: "error", text: file.size > MAX_SOURCE_BYTES ? "Choose a photo smaller than 20 MB." : "Please choose an image for your profile photo." });
      return;
    }
    const generation = ++photoGeneration.current;
    const sourceUrl = URL.createObjectURL(file);
    setPhotoDraft({ url: sourceUrl, blob: null });
    setPhotoOperation("preparing");
    try {
      const blob = await preparePhoto(sourceUrl);
      if (generation !== photoGeneration.current) return;
      setPhotoDraft({ url: URL.createObjectURL(blob), blob });
    } catch (error) {
      if (generation !== photoGeneration.current) return;
      setPhotoDraft(null);
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "This photo couldn’t be opened. Please try another image." });
    } finally {
      if (generation === photoGeneration.current) setPhotoOperation(null);
    }
  }

  async function savePhoto() {
    if (busy || !photoDraft?.blob) return;
    setPhotoOperation("saving");
    setFeedback(null);
    try {
      const form = new FormData();
      form.set("photo", photoDraft.blob, "profile-photo.jpg");
      const next = await profileResponse(await fetch("/api/profile/photo", { method: "POST", body: form, credentials: "same-origin" }));
      saved(next);
      setPhotoDraft(null);
      setFeedback({ kind: "success", text: "Your new photo is saved." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Your photo couldn’t be saved. Please try again." });
    } finally {
      setPhotoOperation(null);
    }
  }

  async function removePhoto() {
    if (busy || !profile.avatarUrl) return;
    setPhotoOperation("removing");
    setFeedback(null);
    try {
      const next = await profileResponse(await fetch("/api/profile/photo", { method: "DELETE", credentials: "same-origin" }));
      saved(next);
      setFeedback({ kind: "success", text: "Your profile photo has been removed." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Your photo couldn’t be removed. Please try again." });
    } finally {
      setPhotoOperation(null);
    }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !nameChanged) return;
    const name = displayName.trim();
    if (!name || name.length > MAX_NAME_LENGTH) {
      setNameError(`Enter a name between 1 and ${MAX_NAME_LENGTH} characters.`);
      return;
    }
    setSavingName(true);
    setNameError("");
    setFeedback(null);
    try {
      const next = await profileResponse(await fetch("/api/profile", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name }) }));
      saved(next, true);
      setFeedback({ kind: "success", text: "Your name is saved." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Your name couldn’t be saved. Please try again." });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <main className={styles.workspace} data-native-haptics="managed">
      <header className={styles.heading}>
        <p>Your account</p>
        <h1>Your profile</h1>
        <span>A familiar face. A little more you.</span>
      </header>
      <div className={styles.layout}>
        <section className={styles.identity} aria-label="Your profile photo">
          <ElasticBubble className={styles.avatarBubble}>
            <button type="button" className={styles.avatarButton} onClick={() => inputRef.current?.click()} disabled={busy} aria-label={profile.avatarUrl ? "Change profile photo" : "Add profile photo"} aria-describedby="profile-photo-hint" aria-busy={photoOperation !== null}>
              {showImage ? <Image src={photoUrl!} alt="" width={128} height={128} unoptimized className={styles.avatarImage} onError={() => setFailedImage(photoUrl)} /> : <span className={styles.initials} aria-hidden="true">{initials(displayName, profile.email)}</span>}
              <span className={styles.cameraBadge}>{photoOperation ? <span className={styles.spinner} /> : <StockIcon name="camera" />}</span>
            </button>
          </ElasticBubble>
          <input ref={inputRef} className={styles.fileInput} type="file" accept="image/*" onChange={choosePhoto} disabled={busy} aria-label="Choose a profile photo" tabIndex={-1} />
          <h2>{profile.displayName || "Your StockGPT profile"}</h2>
          <p className={styles.identityEmail}>{profile.email}</p>
          <div className={styles.photoActions}>
            {photoDraft ? <>
              <button type="button" className={styles.photoSave} onClick={() => void savePhoto()} disabled={busy || !photoDraft.blob}>{photoOperation === "preparing" ? "Preparing…" : photoOperation === "saving" ? "Saving…" : "Save photo"}</button>
              <button type="button" className={styles.textButton} disabled={busy} onClick={() => { setPhotoDraft(null); setFeedback(null); }}>Cancel</button>
            </> : <>
              <ElasticBubble><button type="button" className={styles.changePhoto} onClick={() => inputRef.current?.click()} disabled={busy}>{profile.avatarUrl ? "Change photo" : "Add photo"}</button></ElasticBubble>
              {profile.avatarUrl && <button type="button" className={styles.textButton} disabled={busy} onClick={() => void removePhoto()}>{photoOperation === "removing" ? "Removing…" : "Remove"}</button>}
            </>}
          </div>
          <p id="profile-photo-hint" className={styles.photoHint}>{photoDraft ? "Preview your photo, then save it when you’re happy." : "Choose a photo from your library. We’ll crop it to fit."}</p>
        </section>
        <section className={styles.details} aria-labelledby="profile-details-title">
          <div className={styles.sectionTitle}><StockIcon name="account" /><h2 id="profile-details-title">The essentials</h2></div>
          <form onSubmit={saveName} aria-busy={savingName}>
            <label htmlFor="profile-display-name">Your name</label>
            <input id="profile-display-name" name="displayName" type="text" autoComplete="name" value={displayName} maxLength={MAX_NAME_LENGTH} disabled={busy} onChange={event => { setDisplayName(event.target.value); setNameError(""); setFeedback(null); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "profile-name-error" : "profile-name-hint"} />
            {nameError ? <p id="profile-name-error" className={styles.fieldError} role="alert">{nameError}</p> : <p id="profile-name-hint" className={styles.fieldHint}>The name you’ll see around StockGPT.</p>}
            <div className={styles.accountDetail}><span>Email address</span><p>{profile.email}</p><small>Your sign-in email.</small></div>
            {joined && <div className={styles.memberSince}><StockIcon name="clock" /><span>With StockGPT since {joined}</span></div>}
            <button type="submit" className={styles.saveButton} disabled={busy || !nameChanged}>{savingName ? <><span className={styles.spinner} />Saving your name…</> : <><StockIcon name="check" />Save name</>}</button>
          </form>
          <div className={styles.feedback} aria-live="polite" aria-atomic="true">{feedback && <p className={feedback.kind === "error" ? styles.error : styles.success} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.kind === "success" && <StockIcon name="check" />}{feedback.text}</p>}</div>
        </section>
      </div>
      <Link href="/settings" prefetch={false} className={styles.settingsLink}><StockIcon name="settings" /><span>Account settings</span><span aria-hidden="true">›</span></Link>
    </main>
  );
}
