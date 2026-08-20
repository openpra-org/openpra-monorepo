import { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarIcon, FolderIcon } from "../welcome/icons";
import "./css/statsStrip.css";

function StatsStrip({
  memberSince,
  projectCount,
}: {
  memberSince: string;
  projectCount: number;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="pf__stats">
      <div className="pf__stat">
        <span className="pf__stat-icon"><CalendarIcon /></span>
        <div>
          <div className="pf__stat-label">Member since</div>
          <div className="pf__stat-value">{memberSince}</div>
        </div>
      </div>
      <div className="pf__stat">
        <span className="pf__stat-icon"><FolderIcon /></span>
        <div>
          <div className="pf__stat-label">Projects</div>
          <div className="pf__stat-value">
            {projectCount}
            <button
              type="button"
              className="pf__stat-link"
              onClick={() => { navigate("/projects"); }}
            >
              View all →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { StatsStrip };
