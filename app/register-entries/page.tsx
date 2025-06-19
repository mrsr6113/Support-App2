"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
  CheckCircle,
  Upload,
  Plus,
  Save,
  Loader2,
  Eye,
  FileText,
  Settings,
  Trash2,
  Copy,
  Download,
  UploadIcon,
} from "lucide-react"

interface TroubleshootingEntry {
  id: string
  image: File | null
  imagePreview: string | null
  iconName: string
  iconDescription: string
  content: string
  category: string
  subcategory: string
  issueType: string
  severityLevel: string
  urgencyLevel: string
  difficultyLevel: string
  estimatedTimeMinutes: number
  toolsRequired: string[]
  safetyWarnings: string[]
  tags: string[]
  visualIndicators: string[]
  indicatorStates: string[]
  errors: string[]
  isValid: boolean
}

interface RegistrationResult {
  index: number
  success: boolean
  id?: string
  error?: string
  iconName: string
}

interface Category {
  value: string
  label: string
  description: string
  icon: string
  color: string
}

const SEVERITY_LEVELS = [
  { value: "critical", label: "Critical", description: "Immediate safety risk or complete failure" },
  { value: "high", label: "High", description: "Significant malfunction or safety concern" },
  { value: "medium", label: "Medium", description: "Performance impact or potential future problem" },
  { value: "low", label: "Low", description: "Cosmetic or minor functional issue" },
]

const URGENCY_LEVELS = [
  { value: "immediate", label: "Immediate", description: "Requires immediate action" },
  { value: "urgent", label: "Urgent", description: "Should be addressed within hours" },
  { value: "normal", label: "Normal", description: "Can be addressed within days" },
  { value: "low", label: "Low", description: "Can be scheduled for later" },
]

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner", description: "No special skills required" },
  { value: "intermediate", label: "Intermediate", description: "Basic technical knowledge needed" },
  { value: "advanced", label: "Advanced", description: "Significant technical expertise required" },
  { value: "expert", label: "Expert", description: "Professional service recommended" },
]

const ISSUE_TYPES = [
  { value: "visual_indicator", label: "Visual Indicator", description: "LED lights, displays, status indicators" },
  { value: "physical_damage", label: "Physical Damage", description: "Structural damage, wear, corrosion" },
  { value: "malfunction", label: "Malfunction", description: "Operational issues, performance problems" },
  { value: "maintenance", label: "Maintenance", description: "Routine maintenance and care" },
  { value: "general", label: "General", description: "General troubleshooting" },
]

export default function RegisterEntriesPage() {
  const [entries, setEntries] = useState<TroubleshootingEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [registrationResults, setRegistrationResults] = useState<RegistrationResult[]>([])
  const [sessionId, setSessionId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("form")

  // Generate session ID
  useEffect(() => {
    setSessionId(`reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }, [])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/generic-rag/categories")
        const result = await response.json()
        if (result.success) {
          setCategories(result.categories)
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error)
      }
    }

    fetchCategories()
  }, [])

  // Initialize with one empty entry
  useEffect(() => {
    if (entries.length === 0) {
      addNewEntry()
    }
  }, [entries.length])

  const createEmptyEntry = (): TroubleshootingEntry => ({
    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    image: null,
    imagePreview: null,
    iconName: "",
    iconDescription: "",
    content: "",
    category: "general",
    subcategory: "",
    issueType: "visual_indicator",
    severityLevel: "medium",
    urgencyLevel: "normal",
    difficultyLevel: "intermediate",
    estimatedTimeMinutes: 15,
    toolsRequired: [],
    safetyWarnings: [],
    tags: [],
    visualIndicators: [],
    indicatorStates: [],
    errors: [],
    isValid: false,
  })

  const addNewEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry()])
  }

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const duplicateEntry = (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (entry) {
      const duplicated = {
        ...entry,
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        iconName: `${entry.iconName} (Copy)`,
        image: null,
        imagePreview: null,
      }
      setEntries((prev) => [...prev, duplicated])
    }
  }

  const updateEntry = (id: string, updates: Partial<TroubleshootingEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          const updated = { ...entry, ...updates }
          updated.errors = validateEntry(updated)
          updated.isValid = updated.errors.length === 0
          return updated
        }
        return entry
      }),
    )
  }

  const validateEntry = (entry: TroubleshootingEntry): string[] => {
    const errors: string[] = []

    if (!entry.image) errors.push("Image is required")
    if (!entry.iconName.trim()) errors.push("Icon name is required")
    if (!entry.iconDescription.trim()) errors.push("Icon description is required")
    if (!entry.content.trim()) errors.push("Troubleshooting content is required")

    if (entry.iconName.length > 200) errors.push("Icon name must be less than 200 characters")
    if (entry.iconDescription.length > 1000) errors.push("Icon description must be less than 1000 characters")
    if (entry.content.length > 10000) errors.push("Content must be less than 10,000 characters")

    return errors
  }

  const handleImageUpload = (entryId: string, file: File) => {
    // Validate file
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      updateEntry(entryId, { errors: ["Invalid image format. Supported: JPG, PNG, WebP"] })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      updateEntry(entryId, { errors: ["Image file size must be less than 10MB"] })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      updateEntry(entryId, {
        image: file,
        imagePreview: reader.result as string,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleArrayFieldUpdate = (entryId: string, field: keyof TroubleshootingEntry, value: string) => {
    const arrayValue = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    updateEntry(entryId, { [field]: arrayValue })
  }

  const submitRegistration = async () => {
    const validEntries = entries.filter((entry) => entry.isValid)

    if (validEntries.length === 0) {
      alert("Please ensure at least one entry is valid before submitting.")
      return
    }

    setIsLoading(true)
    setRegistrationResults([])

    try {
      // Convert entries to API format
      const apiEntries = await Promise.all(
        validEntries.map(async (entry) => {
          if (!entry.image) throw new Error("Image is required")

          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const result = reader.result as string
              resolve(result.split(",")[1]) // Remove data:image/...;base64, prefix
            }
            reader.onerror = reject
            reader.readAsDataURL(entry.image)
          })

          return {
            image: base64,
            mimeType: entry.image.type,
            iconName: entry.iconName,
            iconDescription: entry.iconDescription,
            content: entry.content,
            category: entry.category,
            subcategory: entry.subcategory || undefined,
            issueType: entry.issueType,
            severityLevel: entry.severityLevel,
            urgencyLevel: entry.urgencyLevel,
            difficultyLevel: entry.difficultyLevel,
            estimatedTimeMinutes: entry.estimatedTimeMinutes,
            toolsRequired: entry.toolsRequired,
            safetyWarnings: entry.safetyWarnings,
            tags: entry.tags,
            visualIndicators: entry.visualIndicators,
            indicatorStates: entry.indicatorStates,
          }
        }),
      )

      const response = await fetch("/api/generic-rag/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: apiEntries,
          sessionId,
          userAgent: navigator.userAgent,
        }),
      })

      const result = await response.json()

      if (result.success || result.results) {
        setRegistrationResults(result.results || [])
        setActiveTab("results")

        // Remove successfully registered entries
        const successfulIndices = result.results
          .filter((r: RegistrationResult) => r.success)
          .map((r: RegistrationResult) => r.index)

        setEntries((prev) => prev.filter((_, index) => !successfulIndices.includes(index)))

        // Add a new empty entry if all were successful
        if (entries.length === successfulIndices.length) {
          addNewEntry()
        }
      } else {
        alert(`Registration failed: ${result.error}`)
      }
    } catch (error) {
      console.error("Registration error:", error)
      alert(`Registration failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadExampleEntries = () => {
    const exampleEntries: Partial<TroubleshootingEntry>[] = [
      {
        iconName: "Waste Container Full Indicator",
        iconDescription:
          "A red LED light that illuminates when the waste container is full or nearly full. The light may be solid or blinking depending on the urgency.",
        content:
          "Empty the waste container immediately. Even if the indicator is flashing and the container doesn't appear completely full, empty it to prevent overflow. After emptying, the indicator should turn off within 30 seconds. If the light remains on, check for blockages or sensor issues.",
        category: "maintenance",
        issueType: "visual_indicator",
        severityLevel: "medium",
        urgencyLevel: "normal",
        difficultyLevel: "beginner",
        estimatedTimeMinutes: 5,
        toolsRequired: [],
        safetyWarnings: ["Ensure machine is powered off before removing waste container"],
        tags: ["waste", "container", "full", "maintenance", "led", "indicator"],
        visualIndicators: ["red_led", "status_light"],
        indicatorStates: ["solid", "blinking"],
      },
      {
        iconName: "Waste Container Empty Status",
        iconDescription:
          "The normal state when the waste container indicator light is off, indicating the container has sufficient capacity.",
        content:
          "This is the normal operating state. The waste container has sufficient capacity and no action is required. Continue normal operation. Monitor the indicator during use - when it begins to blink or turn solid red, prepare to empty the container soon.",
        category: "maintenance",
        issueType: "visual_indicator",
        severityLevel: "low",
        urgencyLevel: "low",
        difficultyLevel: "beginner",
        estimatedTimeMinutes: 0,
        toolsRequired: [],
        safetyWarnings: [],
        tags: ["waste", "container", "empty", "normal", "status"],
        visualIndicators: ["status_light"],
        indicatorStates: ["off"],
      },
    ]

    // Add example entries
    exampleEntries.forEach((example) => {
      const newEntry = { ...createEmptyEntry(), ...example }
      newEntry.errors = validateEntry(newEntry)
      newEntry.isValid = newEntry.errors.length === 0
      setEntries((prev) => [...prev, newEntry])
    })
  }

  const exportEntries = () => {
    const exportData = {
      entries: entries.map((entry) => ({
        ...entry,
        image: null, // Don't export image files
        imagePreview: null,
      })),
      exportedAt: new Date().toISOString(),
      sessionId,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `troubleshooting-entries-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importEntries = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.entries && Array.isArray(data.entries)) {
          const importedEntries = data.entries.map((entry: any) => ({
            ...createEmptyEntry(),
            ...entry,
            id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          }))

          setEntries((prev) => [...prev, ...importedEntries])
        }
      } catch (error) {
        alert("Failed to import entries. Please check the file format.")
      }
    }
    reader.readAsText(file)
  }

  const validEntryCount = entries.filter((entry) => entry.isValid).length
  const totalEntryCount = entries.length

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Register Troubleshooting Entries</h1>
        <p className="text-gray-600">
          Add new troubleshooting information to the multimodal RAG system. Upload images and provide detailed
          descriptions to help users solve product issues.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Entry Form ({totalEntryCount})
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="examples" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Examples
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={addNewEntry} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
            <Button onClick={loadExampleEntries} variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Load Examples
            </Button>
            <Button onClick={exportEntries} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Import
                </span>
              </Button>
              <input type="file" accept=".json" onChange={importEntries} className="hidden" />
            </label>
            <div className="ml-auto">
              <Button
                onClick={submitRegistration}
                disabled={isLoading || validEntryCount === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Register {validEntryCount} Entries
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {entries.map((entry, index) => (
                <Card key={entry.id} className={`${entry.isValid ? "border-green-200" : "border-red-200"}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Entry {index + 1}
                        {entry.isValid ? (
                          <Badge variant="secondary" className="ml-2 text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="ml-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {entry.errors.length} Error(s)
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button onClick={() => duplicateEntry(entry.id)} variant="outline" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => removeEntry(entry.id)}
                          variant="outline"
                          size="sm"
                          disabled={entries.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {entry.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {entry.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Image Upload */}
                    <div>
                      <Label htmlFor={`image-${entry.id}`}>Product Issue Image *</Label>
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
                        onClick={() => document.getElementById(`image-${entry.id}`)?.click()}
                      >
                        {entry.imagePreview ? (
                          <img
                            src={entry.imagePreview || "/placeholder.svg"}
                            alt="Preview"
                            className="max-w-full max-h-48 mx-auto rounded"
                          />
                        ) : (
                          <div className="py-8">
                            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p className="text-gray-500">Click to upload image</p>
                            <p className="text-sm text-gray-400">JPG, PNG, WebP (max 10MB)</p>
                          </div>
                        )}
                      </div>
                      <input
                        id={`image-${entry.id}`}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(entry.id, file)
                        }}
                        className="hidden"
                      />
                    </div>

                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`iconName-${entry.id}`}>Icon Name *</Label>
                        <Input
                          id={`iconName-${entry.id}`}
                          value={entry.iconName}
                          onChange={(e) => updateEntry(entry.id, { iconName: e.target.value })}
                          placeholder="e.g., Waste Container Full Indicator"
                          maxLength={200}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`category-${entry.id}`}>Category</Label>
                        <Select
                          value={entry.category}
                          onValueChange={(value) => updateEntry(entry.id, { category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`iconDescription-${entry.id}`}>Icon Description *</Label>
                      <Textarea
                        id={`iconDescription-${entry.id}`}
                        value={entry.iconDescription}
                        onChange={(e) => updateEntry(entry.id, { iconDescription: e.target.value })}
                        placeholder="Detailed description of the visual indicator and its meaning..."
                        maxLength={1000}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`content-${entry.id}`}>Troubleshooting Steps *</Label>
                      <Textarea
                        id={`content-${entry.id}`}
                        value={entry.content}
                        onChange={(e) => updateEntry(entry.id, { content: e.target.value })}
                        placeholder="Step-by-step troubleshooting instructions and solutions..."
                        maxLength={10000}
                        rows={4}
                      />
                    </div>

                    {/* Classification */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`issueType-${entry.id}`}>Issue Type</Label>
                        <Select
                          value={entry.issueType}
                          onValueChange={(value) => updateEntry(entry.id, { issueType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ISSUE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`severity-${entry.id}`}>Severity</Label>
                        <Select
                          value={entry.severityLevel}
                          onValueChange={(value) => updateEntry(entry.id, { severityLevel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEVERITY_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`difficulty-${entry.id}`}>Difficulty</Label>
                        <Select
                          value={entry.difficultyLevel}
                          onValueChange={(value) => updateEntry(entry.id, { difficultyLevel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIFFICULTY_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`time-${entry.id}`}>Estimated Time (minutes)</Label>
                        <Input
                          id={`time-${entry.id}`}
                          type="number"
                          value={entry.estimatedTimeMinutes}
                          onChange={(e) =>
                            updateEntry(entry.id, { estimatedTimeMinutes: Number.parseInt(e.target.value) || 15 })
                          }
                          min={1}
                          max={480}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`subcategory-${entry.id}`}>Subcategory</Label>
                        <Input
                          id={`subcategory-${entry.id}`}
                          value={entry.subcategory}
                          onChange={(e) => updateEntry(entry.id, { subcategory: e.target.value })}
                          placeholder="Optional subcategory"
                        />
                      </div>
                    </div>

                    {/* Arrays */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`tools-${entry.id}`}>Tools Required</Label>
                        <Input
                          id={`tools-${entry.id}`}
                          value={entry.toolsRequired.join(", ")}
                          onChange={(e) => handleArrayFieldUpdate(entry.id, "toolsRequired", e.target.value)}
                          placeholder="screwdriver, wrench, multimeter (comma-separated)"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`tags-${entry.id}`}>Tags</Label>
                        <Input
                          id={`tags-${entry.id}`}
                          value={entry.tags.join(", ")}
                          onChange={(e) => handleArrayFieldUpdate(entry.id, "tags", e.target.value)}
                          placeholder="led, indicator, maintenance (comma-separated)"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`safety-${entry.id}`}>Safety Warnings</Label>
                      <Input
                        id={`safety-${entry.id}`}
                        value={entry.safetyWarnings.join(", ")}
                        onChange={(e) => handleArrayFieldUpdate(entry.id, "safetyWarnings", e.target.value)}
                        placeholder="Turn off power, Wear safety glasses (comma-separated)"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">Registration Results</h2>
            {registrationResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-semibold">Successful</p>
                        <p className="text-2xl font-bold text-green-600">
                          {registrationResults.filter((r) => r.success).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="font-semibold">Failed</p>
                        <p className="text-2xl font-bold text-red-600">
                          {registrationResults.filter((r) => !r.success).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">Total</p>
                        <p className="text-2xl font-bold text-blue-600">{registrationResults.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-gray-500">No registration results yet. Submit entries to see results here.</p>
            )}
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {registrationResults.map((result, index) => (
                <Card key={index} className={result.success ? "border-green-200" : "border-red-200"}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          <h3 className="font-semibold">{result.iconName}</h3>
                          <Badge variant={result.success ? "secondary" : "destructive"}>Entry {result.index + 1}</Badge>
                        </div>
                        {result.success ? (
                          <p className="text-green-600">Successfully registered with ID: {result.id}</p>
                        ) : (
                          <p className="text-red-600">Failed: {result.error}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">Example Entries</h2>
            <p className="text-gray-600">
              Here are some example troubleshooting entries to help you understand the expected format and content.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Waste Container - Full</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src="/examples/waste-container-lit.png"
                  alt="Waste container with lit indicator"
                  className="w-full h-32 object-cover rounded mb-3"
                />
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Icon:</strong> Waste Container Full Indicator
                  </p>
                  <p>
                    <strong>Description:</strong> Red LED light indicating full container
                  </p>
                  <p>
                    <strong>Solution:</strong> Empty the waste container immediately
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="secondary">maintenance</Badge>
                    <Badge variant="outline">medium</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Waste Container - Normal</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src="/examples/waste-container-unlit.png"
                  alt="Waste container with unlit indicator"
                  className="w-full h-32 object-cover rounded mb-3"
                />
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Icon:</strong> Waste Container Empty Status
                  </p>
                  <p>
                    <strong>Description:</strong> Normal state with indicator off
                  </p>
                  <p>
                    <strong>Solution:</strong> Continue normal operation
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="secondary">maintenance</Badge>
                    <Badge variant="outline">low</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Container Icon</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src="/examples/waste-container-icon.png"
                  alt="Waste container icon"
                  className="w-full h-32 object-cover rounded mb-3"
                />
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Icon:</strong> Waste Container Symbol
                  </p>
                  <p>
                    <strong>Description:</strong> Standard waste container icon
                  </p>
                  <p>
                    <strong>Solution:</strong> Reference for container identification
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="secondary">general</Badge>
                    <Badge variant="outline">low</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Button onClick={loadExampleEntries} className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Load These Examples into Form
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
