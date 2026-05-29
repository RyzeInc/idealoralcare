/**
 * AgentRepCodeSelector Component
 * 
 * A toggleable selector that allows users to either:
 * 1. Enter a rep code directly
 * 2. Select an agent by name from Group -> Agent dropdowns
 * 
 * Features:
 * - Toggle between "Rep Code" and "Agent" modes
 * - Group dropdown filters agents (optional)
 * - Agent dropdown is a searchable combobox
 * - Cross-population: switching modes auto-fills the other side
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check, X, ChevronDown, Search, User, Building2 } from "lucide-react";

interface PublicAgent {
  id: string;
  name: string;
  repCode: string;
  groupId: string | null;
  groupName: string | null;
  slug: string;
}

interface PublicGroup {
  id: string;
  name: string;
  type: "program_manager" | "fmo" | "agency";
}

interface AgentRepCodeSelectorProps {
  referralCode: string | undefined;
  onReferralCodeChange: (code: string) => void;
  /** When true, the code was pre-set via URL — show a subtle Change link instead of the X */
  lockedFromUrl?: boolean;
}

type Mode = "repCode" | "agent";

export function AgentRepCodeSelector({
  referralCode,
  onReferralCodeChange,
  lockedFromUrl = false,
}: AgentRepCodeSelectorProps) {
  const [mode, setMode] = useState<Mode>("repCode");
  const [repCodeInput, setRepCodeInput] = useState(referralCode || "");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  
  const agentInputRef = useRef<HTMLInputElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch agents and groups from Convex
  // Use bracket notation for nested module paths to satisfy TypeScript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentsApi = (api as any)["enrollment/agents"];
  const agents = useQuery(agentsApi.listPublicAgents) as PublicAgent[] | undefined;
  const groups = useQuery(agentsApi.listPublicGroups) as PublicGroup[] | undefined;
  const agentByCode = useQuery(
    agentsApi.getAgentByRepCode,
    referralCode ? { code: referralCode } : "skip"
  ) as PublicAgent | null | undefined;

  // Filter agents by selected group (if any) and search query
  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    
    let filtered = agents;
    
    // Filter by group if selected
    if (selectedGroupId) {
      filtered = filtered.filter((a) => a.groupId === selectedGroupId);
    }
    
    // Filter by search query
    if (agentSearchQuery.trim()) {
      const query = agentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.repCode.toLowerCase().includes(query) ||
          (a.groupName && a.groupName.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [agents, selectedGroupId, agentSearchQuery]);

  // Get selected agent object
  const selectedAgent = useMemo(() => {
    if (!selectedAgentId || !agents) return null;
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [selectedAgentId, agents]);

  // Get selected group object
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId || !groups) return null;
    return groups.find((g) => g.id === selectedGroupId) || null;
  }, [selectedGroupId, groups]);

  // Cross-populate: when a rep code is entered and we switch to agent mode
  useEffect(() => {
    if (mode === "agent" && agentByCode && !selectedAgentId) {
      setSelectedAgentId(agentByCode.id);
      if (agentByCode.groupId) {
        setSelectedGroupId(agentByCode.groupId);
      }
      setAgentSearchQuery(agentByCode.name);
    }
  }, [mode, agentByCode, selectedAgentId]);

  // Cross-populate: when an agent is selected and we switch to rep code mode
  useEffect(() => {
    if (mode === "repCode" && selectedAgent && !repCodeInput) {
      setRepCodeInput(selectedAgent.repCode);
    }
  }, [mode, selectedAgent, repCodeInput]);

  // Sync external referralCode changes
  useEffect(() => {
    if (referralCode && referralCode !== repCodeInput) {
      setRepCodeInput(referralCode);
    }
  }, [referralCode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAgentDropdownOpen(false);
      }
      if (
        groupDropdownRef.current &&
        !groupDropdownRef.current.contains(event.target as Node)
      ) {
        setIsGroupDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle mode switch
  const handleModeSwitch = (newMode: Mode) => {
    if (newMode === mode) return;
    
    // Cross-populate when switching
    if (newMode === "agent" && repCodeInput) {
      // Will be handled by the agentByCode useEffect
    } else if (newMode === "repCode" && selectedAgent) {
      setRepCodeInput(selectedAgent.repCode);
      onReferralCodeChange(selectedAgent.repCode);
    }
    
    setMode(newMode);
  };

  // Handle rep code submission
  const handleRepCodeSubmit = () => {
    const code = repCodeInput.trim();
    if (code) {
      onReferralCodeChange(code);
    }
  };

  // Handle agent selection
  const handleAgentSelect = (agent: PublicAgent) => {
    setSelectedAgentId(agent.id);
    setSelectedGroupId(agent.groupId);
    setAgentSearchQuery(agent.name);
    setIsAgentDropdownOpen(false);
    setRepCodeInput(agent.repCode);
    onReferralCodeChange(agent.repCode);
  };

  // Handle group selection
  const handleGroupSelect = (group: PublicGroup | null) => {
    setSelectedGroupId(group?.id || null);
    setIsGroupDropdownOpen(false);
    // Don't clear agent if they already selected one in this group
    if (group && selectedAgent && selectedAgent.groupId !== group.id) {
      setSelectedAgentId(null);
      setAgentSearchQuery("");
    }
  };

  // Clear selection
  const handleClear = () => {
    setRepCodeInput("");
    setSelectedAgentId(null);
    setSelectedGroupId(null);
    setAgentSearchQuery("");
    onReferralCodeChange("");
  };

  // Styles
  const toggleButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: isActive ? 600 : 400,
    color: isActive ? "#0066CC" : "#64748b",
    background: isActive ? "#f0f9ff" : "transparent",
    border: "none",
    borderBottom: isActive ? "2px solid #0066CC" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  const dropdownContainerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    paddingRight: "2.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    boxSizing: "border-box",
    outline: "none",
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: "4px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    maxHeight: "200px",
    overflowY: "auto",
    zIndex: 50,
  };

  const dropdownItemStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: "0.625rem 0.875rem",
    cursor: "pointer",
    background: isSelected ? "#f0f9ff" : "transparent",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.875rem",
    color: "#374151",
  });

  // Render confirmed state
  if (referralCode && mode === "repCode") {
    return (
      <div className="glass-card" style={{ padding: "1.25rem 2rem", overflow: "visible" }}>
        {/* Header - Agent left, Rep Code right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <button
            onClick={() => handleModeSwitch("agent")}
            style={toggleButtonStyle(false)}
          >
            Agent
          </button>
          <button
            onClick={() => handleModeSwitch("repCode")}
            style={toggleButtonStyle(true)}
          >
            Rep Code
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 0.875rem",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            color: "#0369a1",
            fontWeight: 500,
          }}>
            <Check size={14} color="#0284c7" />
            {selectedAgent ? (
              <span>
                {selectedAgent.name}
                {selectedAgent.groupName && (
                  <span style={{ color: "#64748b", fontWeight: 400 }}> • {selectedAgent.groupName}</span>
                )}
                <span style={{ color: "#94a3b8", fontWeight: 400 }}> ({referralCode})</span>
              </span>
            ) : (
              <span>Code: {referralCode}</span>
            )}
          </div>
          <button
            onClick={() => {
              if (lockedFromUrl) {
                // Clear the server-set cookie before allowing manual override
                document.cookie = "ideal_ref=;path=/;max-age=0";
              }
              handleClear();
            }}
            style={lockedFromUrl
              ? { background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px 6px", fontSize: "0.75rem", textDecoration: "underline" }
              : { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}
            aria-label={lockedFromUrl ? "Change referral code" : "Remove referral code"}
          >
            {lockedFromUrl ? "Change" : <X size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: "1.25rem 2rem", overflow: "visible" }}>
      {/* Header with mode toggle - Agent left, Rep Code right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <button
          onClick={() => handleModeSwitch("agent")}
          style={toggleButtonStyle(mode === "agent")}
        >
          Agent
        </button>
        <button
          onClick={() => handleModeSwitch("repCode")}
          style={toggleButtonStyle(mode === "repCode")}
        >
          Rep Code
        </button>
      </div>

      {/* Mode-specific content */}
      {mode === "repCode" ? (
        // REP CODE MODE
        <div>
          <input
            type="text"
            placeholder="Enter your rep's code"
            value={repCodeInput}
            onChange={(e) => setRepCodeInput(e.target.value)}
            onBlur={handleRepCodeSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRepCodeSubmit();
              }
            }}
            style={inputStyle}
          />
        </div>
      ) : (
        // AGENT MODE
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Group Dropdown */}
          <div ref={groupDropdownRef} style={dropdownContainerStyle}>
            <div
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                paddingRight: "0.875rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Building2 size={16} color="#94a3b8" />
                {selectedGroup ? (
                  <span>{selectedGroup.name}</span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>Select a group (optional)</span>
                )}
              </div>
              <ChevronDown size={16} color="#94a3b8" />
            </div>
            
            {isGroupDropdownOpen && groups && (
              <div style={dropdownStyle}>
                <div
                  onClick={() => handleGroupSelect(null)}
                  style={dropdownItemStyle(!selectedGroupId)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = !selectedGroupId ? "#f0f9ff" : "transparent")}
                >
                  <span style={{ color: "#64748b" }}>All Groups</span>
                </div>
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleGroupSelect(group)}
                    style={dropdownItemStyle(selectedGroupId === group.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = selectedGroupId === group.id ? "#f0f9ff" : "transparent")}
                  >
                    <Building2 size={14} color="#64748b" />
                    <span>{group.name}</span>
                    <span style={{ 
                      marginLeft: "auto", 
                      fontSize: "0.75rem", 
                      color: "#94a3b8",
                      textTransform: "uppercase",
                    }}>
                      {group.type.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Combobox */}
          <div ref={agentDropdownRef} style={dropdownContainerStyle}>
            <div style={{ position: "relative" }}>
              <Search 
                size={16} 
                color="#94a3b8" 
                style={{ 
                  position: "absolute", 
                  left: "0.75rem", 
                  top: "50%", 
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }} 
              />
              <input
                ref={agentInputRef}
                type="text"
                placeholder="Search for an agent..."
                value={agentSearchQuery}
                onChange={(e) => {
                  setAgentSearchQuery(e.target.value);
                  setIsAgentDropdownOpen(true);
                }}
                onFocus={() => setIsAgentDropdownOpen(true)}
                style={{
                  ...inputStyle,
                  paddingLeft: "2.5rem",
                }}
              />
              <ChevronDown 
                size={16} 
                color="#94a3b8"
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                }}
                onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              />
            </div>
            
            {isAgentDropdownOpen && (
              <div style={dropdownStyle}>
                {filteredAgents.length === 0 ? (
                  <div style={{ padding: "0.75rem", color: "#94a3b8", textAlign: "center", fontSize: "0.875rem" }}>
                    {agents === undefined ? "Loading agents..." : "No agents found"}
                  </div>
                ) : (
                  filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => handleAgentSelect(agent)}
                      style={dropdownItemStyle(selectedAgentId === agent.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = selectedAgentId === agent.id ? "#f0f9ff" : "transparent")}
                    >
                      <User size={14} color="#64748b" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{agent.name}</div>
                        {agent.groupName && (
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            {agent.groupName}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                        {agent.repCode}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentRepCodeSelector;
