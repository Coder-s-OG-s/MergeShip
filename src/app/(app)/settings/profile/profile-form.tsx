'use client';

import { useState, useTransition } from 'react';
import { updateProfile, type ProfileUpdateData } from '@/app/actions/profile';
import type { Result } from '@/lib/result';
import { X } from 'lucide-react';

type ProfileFormProps = {
  initialData: {
    bio: string | null;
    skills: string[] | null;
    website_url: string | null;
    twitter_handle: string | null;
  };
};

export function ProfileForm({ initialData }: ProfileFormProps) {
  // Form state
  const [bio, setBio] = useState(initialData.bio || '');
  const [skills, setSkills] = useState<string[]>(initialData.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState(initialData.website_url || '');
  const [twitterHandle, setTwitterHandle] = useState(initialData.twitter_handle || '');

  // UI state
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result<{ message: string }> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Character count for bio
  const bioLength = bio.length;
  const bioMaxLength = 280;

  // Handle adding a skill tag
  const handleAddSkill = () => {
    const trimmedSkill = skillInput.trim();

    if (!trimmedSkill) return;
    if (skills.length >= 10) {
      setFieldErrors({ ...fieldErrors, skills: ['Maximum 10 skills allowed'] });
      return;
    }
    if (skills.includes(trimmedSkill)) {
      setFieldErrors({ ...fieldErrors, skills: ['Skill already added'] });
      return;
    }

    setSkills([...skills, trimmedSkill]);
    setSkillInput('');
    setFieldErrors({ ...fieldErrors, skills: [] });
  };

  // Handle removing a skill tag
  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
    setFieldErrors({ ...fieldErrors, skills: [] });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setResult(null);

    const formData: ProfileUpdateData = {
      bio: bio.trim() || null,
      skills: skills.length > 0 ? skills : null,
      website_url: websiteUrl.trim() || null,
      twitter_handle: twitterHandle.trim() || null,
    };

    startTransition(async () => {
      const result = await updateProfile(formData);
      setResult(result);
    });
  };

  // Handle Enter key in skill input
  const handleSkillInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success/Error Message */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.ok
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="font-medium">{result.ok ? result.data.message : result.error.message}</p>
        </div>
      )}

      {/* Bio Field */}
      <div>
        <label htmlFor="bio" className="mb-2 block text-sm font-medium text-gray-700">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={bioMaxLength}
          rows={4}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tell us about yourself..."
        />
        <div className="mt-1 flex justify-between">
          <p className="text-xs text-gray-500">
            Share your interests, experience, or what you are working on
          </p>
          <p className={`text-xs ${bioLength > bioMaxLength ? 'text-red-600' : 'text-gray-500'}`}>
            {bioLength}/{bioMaxLength}
          </p>
        </div>
        {fieldErrors.bio && <p className="mt-1 text-sm text-red-600">{fieldErrors.bio[0]}</p>}
      </div>

      {/* Skills Field */}
      <div>
        <label htmlFor="skills" className="mb-2 block text-sm font-medium text-gray-700">
          Skills
        </label>
        <div className="mb-2 flex gap-2">
          <input
            id="skills"
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillInputKeyDown}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a skill and press Enter"
            disabled={skills.length >= 10}
          />
          <button
            type="button"
            onClick={handleAddSkill}
            disabled={skills.length >= 10 || !skillInput.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Add
          </button>
        </div>

        {/* Skills Tags Display */}
        {skills.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-sm text-blue-800"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-blue-900"
                  aria-label={`Remove ${skill}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">Add up to 10 skills. Press Enter or click Add.</p>
        {fieldErrors.skills && <p className="mt-1 text-sm text-red-600">{fieldErrors.skills[0]}</p>}
      </div>

      {/* Website URL Field */}
      <div>
        <label htmlFor="website_url" className="mb-2 block text-sm font-medium text-gray-700">
          Website
        </label>
        <input
          id="website_url"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://yourwebsite.com"
        />
        <p className="mt-1 text-xs text-gray-500">Your personal website or portfolio</p>
        {fieldErrors.website_url && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.website_url[0]}</p>
        )}
      </div>

      {/* Twitter Handle Field */}
      <div>
        <label htmlFor="twitter_handle" className="mb-2 block text-sm font-medium text-gray-700">
          Twitter/X Handle
        </label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-gray-500">
            @
          </span>
          <input
            id="twitter_handle"
            type="text"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            maxLength={15}
            className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="username"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Without the @ symbol, max 15 characters</p>
        {fieldErrors.twitter_handle && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.twitter_handle[0]}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
