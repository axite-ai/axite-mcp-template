"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { ShieldCheck, Trash } from "@openai/apps-sdk-ui/components/Icon";

interface Passkey {
  id: string;
  name?: string;
  createdAt?: Date;
}

export default function SecuritySettingsPage() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const fetchPasskeys = async () => {
    try {
      const { data, error } = await authClient.passkey.listUserPasskeys();
      if (error) {
        throw new Error(error.message);
      }
      setPasskeys(data || []);
    } catch (err) {
      console.error("Failed to list passkeys:", err);
    }
  };

  const handleRegisterPasskey = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await authClient.passkey.addPasskey({
        name: `Passkey ${passkeys.length + 1}`,
      });

      if (error) {
        throw new Error(error.message || "Failed to register passkey");
      }

      setSuccess("Passkey registered successfully");
      fetchPasskeys();
    } catch (err) {
      console.error("Passkey registration error:", err);
      setError(err instanceof Error ? err.message : "Failed to register passkey");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this passkey?")) return;

    try {
      const { error } = await authClient.passkey.deletePasskey({ id });

      if (error) {
        throw new Error(error.message);
      }

      fetchPasskeys();
    } catch (err) {
      console.error("Failed to delete passkey:", err);
      setError("Failed to delete passkey");
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="heading-lg text-default mb-2">Security Settings</h1>
      <p className="text-secondary mb-8">Manage your passkeys and account security</p>

      <div className="bg-surface border border-subtle rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="heading-md text-default flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Passkeys
            </h2>
            <p className="text-sm text-secondary mt-1">
              Passkeys allow you to sign in securely without a password using your device's biometrics or security key.
            </p>
          </div>
          <Button
            onClick={handleRegisterPasskey}
            disabled={loading}
            loading={loading}
            color="primary"
          >
            Add Passkey
          </Button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert color="danger" description={error} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <Alert color="success" description={success} />
          </div>
        )}

        <div className="space-y-4">
          {passkeys.length === 0 ? (
            <div className="text-center py-8 text-secondary bg-surface-secondary rounded-lg">
              No passkeys registered yet. Add one to enable secure passwordless sign-in.
            </div>
          ) : (
            passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between p-4 border border-subtle rounded-lg"
              >
                <div>
                  <p className="font-medium text-default">
                    {passkey.name || "Unnamed Passkey"}
                  </p>
                  {passkey.createdAt && (
                    <p className="text-xs text-secondary">
                      Added on {new Date(passkey.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => handleDeletePasskey(passkey.id)}
                  color="danger"
                  variant="ghost"
                  size="sm"
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
