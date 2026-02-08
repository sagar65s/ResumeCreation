import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useResume, useUpdateResume } from "@/hooks/use-resumes";
import { useReactToPrint } from "react-to-print";
import { useForm, useFieldArray } from "react-hook-form";
import { ResumePreview } from "@/components/ResumePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2, Save, Download, ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { motion } from "framer-motion";

export default function Editor() {
  const [match, params] = useRoute("/editor/:id");
  const [, setLocation] = useLocation();
  const resumeId = parseInt(params?.id || "0");
  
  const { data: resume, isLoading } = useResume(resumeId);
  const updateResume = useUpdateResume();
  const componentRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("personal");

  const form = useForm({
    defaultValues: {
      personalInfo: {
        fullName: "",
        email: "",
        phone: "",
        bio: "",
        linkedin: "",
        github: "",
        location: "",
      },
      experience: [],
      education: [],
      skills: [],
      projects: []
    }
  });

  // Load data into form when fetched
  useEffect(() => {
    if (resume) {
      form.reset(resume.content as any);
    }
  }, [resume, form]);

  // Auto-save debouncer could be here, but let's stick to manual save for clarity + button
  const handleSave = () => {
    const content = form.getValues();
    updateResume.mutate({ id: resumeId, content });
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: resume?.title || "Resume",
  });

  // Form Field Arrays
  const { fields: expFields, append: appendExp, remove: removeExp } = useFieldArray({
    control: form.control,
    name: "experience"
  });
  
  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({
    control: form.control,
    name: "education"
  });

  const { fields: skillFields, append: appendSkill, remove: removeSkill } = useFieldArray({
    control: form.control,
    name: "skills" as any // FieldArray expects objects usually but here strings, messy with hook-form types sometimes. Let's fix.
  });

  // Watch for live preview
  const formData = form.watch();

  // Auto-trigger print if redirected from dashboard with download=true
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("download") === "true" && resume && !isLoading) {
      // Small delay to ensure render is complete
      const timer = setTimeout(() => {
        handlePrint();
        // Clean up URL
        window.history.replaceState({}, '', `/editor/${resumeId}`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [resume, isLoading]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-white">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!resume) return <div>Not found</div>;

  return (
    <div className="h-screen flex flex-col bg-background overflow-y-auto">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 bg-card px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <h1 className="text-lg font-semibold text-white hidden sm:block">{resume.title}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleSave} 
            disabled={updateResume.isPending}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {updateResume.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
          <Button 
            onClick={handlePrint}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-y-auto">
        {/* Editor Panel */}
        <div className="w-full md:w-1/2 lg:w-[500px] border-r border-white/10 bg-card/50 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-4 pb-2 border-b border-white/5">
              <TabsList className="w-full bg-black/20">
                <TabsTrigger value="personal" className="flex-1">Personal</TabsTrigger>
                <TabsTrigger value="experience" className="flex-1">Work</TabsTrigger>
                <TabsTrigger value="education" className="flex-1">Edu</TabsTrigger>
                <TabsTrigger value="skills" className="flex-1">Skills</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                
                <TabsContent value="personal" className="space-y-4 m-0">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Full Name</Label>
                    <Input {...form.register("personalInfo.fullName")} className="bg-black/20 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Professional Title / Bio</Label>
                    <Input {...form.register("personalInfo.bio")} className="bg-black/20 border-white/10 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Email</Label>
                      <Input {...form.register("personalInfo.email")} className="bg-black/20 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Phone</Label>
                      <Input {...form.register("personalInfo.phone")} className="bg-black/20 border-white/10 text-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Location</Label>
                    <Input {...form.register("personalInfo.location")} className="bg-black/20 border-white/10 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                      <Label className="text-slate-300">LinkedIn URL</Label>
                      <Input {...form.register("personalInfo.linkedin")} className="bg-black/20 border-white/10 text-white" />
                    </div>
                     <div className="space-y-2">
                      <Label className="text-slate-300">GitHub URL</Label>
                      <Input {...form.register("personalInfo.github")} className="bg-black/20 border-white/10 text-white" />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="experience" className="space-y-4 m-0">
                  {expFields.map((field, index) => (
                    <motion.div 
                      key={field.id} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-slate-300">Role {index + 1}</h4>
                        <Button variant="ghost" size="sm" onClick={() => removeExp(index)} className="h-6 w-6 p-0 text-red-400 hover:bg-red-400/10"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                          <Label className="text-xs text-slate-400">Role Title</Label>
                          <Input {...form.register(`experience.${index}.role`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-400">Company</Label>
                          <Input {...form.register(`experience.${index}.company`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                          <Label className="text-xs text-slate-400">Start Date</Label>
                          <Input {...form.register(`experience.${index}.startDate`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" placeholder="MM/YYYY" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-400">End Date</Label>
                          <Input {...form.register(`experience.${index}.endDate`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" placeholder="Present" />
                        </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-400">Description</Label>
                         <Textarea {...form.register(`experience.${index}.description`)} className="bg-black/40 border-white/10 text-white text-sm min-h-[80px]" />
                      </div>
                    </motion.div>
                  ))}
                  <Button onClick={() => appendExp({ role: "", company: "", startDate: "", description: "", current: false })} variant="outline" className="w-full border-dashed border-white/20 text-slate-400 hover:text-white hover:bg-white/5">
                    <Plus className="w-4 h-4 mr-2" /> Add Experience
                  </Button>
                </TabsContent>

                <TabsContent value="education" className="space-y-4 m-0">
                  {eduFields.map((field, index) => (
                    <div key={field.id} className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-3">
                       <div className="flex justify-between items-start">
                        <h4 className="font-medium text-slate-300">Education {index + 1}</h4>
                        <Button variant="ghost" size="sm" onClick={() => removeEdu(index)} className="h-6 w-6 p-0 text-red-400 hover:bg-red-400/10"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">School / University</Label>
                        <Input {...form.register(`education.${index}.school`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Degree / Major</Label>
                        <Input {...form.register(`education.${index}.degree`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                          <Label className="text-xs text-slate-400">Start Date</Label>
                          <Input {...form.register(`education.${index}.startDate`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-400">End Date</Label>
                          <Input {...form.register(`education.${index}.endDate`)} className="h-8 bg-black/40 border-white/10 text-white text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                   <Button onClick={() => appendEdu({ school: "", degree: "", startDate: "" })} variant="outline" className="w-full border-dashed border-white/20 text-slate-400 hover:text-white hover:bg-white/5">
                    <Plus className="w-4 h-4 mr-2" /> Add Education
                  </Button>
                </TabsContent>

                <TabsContent value="skills" className="space-y-4 m-0">
                   <div className="p-4 rounded-lg bg-black/20 border border-white/5">
                    <Label className="text-slate-300 mb-2 block">Skills (Comma Separated)</Label>
                    <Textarea 
                      className="bg-black/40 border-white/10 text-white min-h-[100px]" 
                      placeholder="React, TypeScript, Node.js, ..."
                      value={formData.skills.join(",")}
                      onChange={(e) => {
                        const skills = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                        form.setValue("skills", skills);
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-2">Separate skills with commas.</p>
                   </div>
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Live Preview Panel */}
        <div className="flex-1 bg-slate-900 overflow-hidden flex flex-col items-center">
          <div className="w-full h-12 flex items-center justify-center border-b border-white/5 bg-black/20 text-xs text-slate-400">
            Live Preview (A4 Size)
          </div>
          <ScrollArea className="flex-1 w-full p-8 md:p-12">
            <ResumePreview 
              ref={componentRef} 
              content={formData as any} 
              className="transform scale-90 origin-top md:scale-100" 
            />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
