import "./home.scss";
import { Editor } from "../editor/editor";
import { HomeFilters } from "./home-filters";


export default function Home() {
    return (
        <div className="container">
            <div className="widgets">
                <div className="card widget">Widget 1</div>
                <div className="card widget">Widget 2</div>
            </div>
            <HomeFilters />
            <div className="scroll">
                <p className="date">15th November 2026</p>
                <div className="card input">
                    <h1>The high heel worked</h1>
                    <p className="summary">
                        <span>rehab + training</span>
                        <span aria-hidden="true">·</span>
                        <span>7h 12m sleep</span>
                        <span aria-hidden="true">·</span>
                        <span>72kg</span>
                    </p>

                    <Editor />
                </div>

                <p className="date">11–14th November 2026</p>

                <p className="date">7–10th November 2026</p>
                <div className="card">
                    <p className="summary">
                        <span>rehab</span>
                        <span aria-hidden="true">·</span>
                        <span>7h 48m sleep</span>
                        <span aria-hidden="true">·</span>
                        <span>72kg</span>
                    </p>
                </div>
                <div className="card">
                    <p className="summary">
                        <span>rehab</span>
                        <span aria-hidden="true">·</span>
                        <span>7h 48m sleep</span>
                        <span aria-hidden="true">·</span>
                        <span>72kg</span>
                    </p>
                </div>
                <div className="card">
                    <p className="summary">
                        <span>rehab</span>
                        <span aria-hidden="true">·</span>
                        <span>7h 48m sleep</span>
                        <span aria-hidden="true">·</span>
                        <span>72kg</span>
                    </p>
                </div>
                <div className="card">
                    <p className="summary">
                        <span>rehab</span>
                        <span aria-hidden="true">·</span>
                        <span>7h 48m sleep</span>
                        <span aria-hidden="true">·</span>
                        <span>72kg</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
