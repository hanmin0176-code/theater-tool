import React from "react";
import { FileJson, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";

type TemplateSummary = {
  id: string;
  name: string;
  createdAt: string;
  bytes?: number;
  versionCount?: number;
  deletedAt?: string;
};

type RoomStorageUsage = {
  templatesCount: number;
  trashedTemplatesCount?: number;
  maxTemplates: number;
  templatesBytes: number;
};

type ImageStorageUsage = {
  imageBytes: number;
  imageCount: number;
  temporaryImageBytes?: number;
  temporaryImageCount?: number;
  missingImages?: number;
};

type Props = {
  roomInput: string;
  activeRoomCode: string;
  templatesLoading: boolean;
  isActivePublicRoom: boolean;
  isCurrentTemplateTooLarge: boolean;
  roomStorageUsage: RoomStorageUsage | null;
  imageStorageUsage: ImageStorageUsage | null;
  imageStorageLimitBytes: number;
  imageStorageRatio: number;
  isImageStorageTooLarge: boolean;
  templatesMessage: string;
  templates: TemplateSummary[];
  trashedTemplates: TemplateSummary[];
  activityLog: Array<{ id: string; type: string; targetName: string; at: string }>;
  selectedTemplateId: string | null;
  selectedTemplateName: string;
  currentTemplateBytes: number;
  currentTemplateLimitBytes: number;
  currentTemplateRatio: number;
  hiddenTemplateCount: number;
  hiddenTrashCount: number;
  isTemplateListExpanded: boolean;
  isTrashExpanded: boolean;
  formatBytes: (value: number) => string;
  formatActivityType: (value: string) => string;
  setRoomInput: (value: string) => void;
  enterTemplateRoom: () => void;
  leaveTemplateRoom: () => void;
  saveNewTemplate: () => void;
  overwriteTemplate: () => void;
  toggleTemplateListExpanded: () => void;
  toggleTrashExpanded: () => void;
  loadTemplate: (template: TemplateSummary) => void;
  restoreLatestTemplateVersion: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  restoreTemplate: (templateId: string) => void;
};

export default function TemplateStoragePanel(props: Props) {
  const {
    roomInput,
    activeRoomCode,
    templatesLoading,
    isActivePublicRoom,
    isCurrentTemplateTooLarge,
    roomStorageUsage,
    imageStorageUsage,
    imageStorageLimitBytes,
    imageStorageRatio,
    isImageStorageTooLarge,
    templatesMessage,
    templates,
    trashedTemplates,
    activityLog,
    selectedTemplateId,
    selectedTemplateName,
    currentTemplateBytes,
    currentTemplateLimitBytes,
    currentTemplateRatio,
    hiddenTemplateCount,
    hiddenTrashCount,
    isTemplateListExpanded,
    isTrashExpanded,
    formatBytes,
    formatActivityType,
    setRoomInput,
    enterTemplateRoom,
    leaveTemplateRoom,
    saveNewTemplate,
    overwriteTemplate,
    toggleTemplateListExpanded,
    toggleTrashExpanded,
    loadTemplate,
    restoreLatestTemplateVersion,
    deleteTemplate,
    restoreTemplate
  } = props;

  return (
    <section className="panel">
      <div className="panelTitle">
        <FileJson size={18} />
        템플릿
      </div>
      <div className="roomBox">
        <input
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") enterTemplateRoom();
          }}
          placeholder="접속코드 6글자"
        />
        <button type="button" onClick={enterTemplateRoom} disabled={templatesLoading}>
          입장
        </button>
      </div>
      {activeRoomCode ? (
        <div className="roomStatus">
          <span>현재 코드: {activeRoomCode}</span>
          <button type="button" onClick={leaveTemplateRoom}>
            나가기
          </button>
        </div>
      ) : (
        <div className="emptyTemplates">접속코드를 입력하면 공유 템플릿 저장소가 열립니다.</div>
      )}
      <div className="templateActionGrid">
        <button type="button" onClick={saveNewTemplate} disabled={!activeRoomCode || templatesLoading || isActivePublicRoom || isCurrentTemplateTooLarge}>
          <Plus size={15} />
          새 템플릿 저장
        </button>
        <button
          type="button"
          onClick={overwriteTemplate}
          disabled={!activeRoomCode || templatesLoading || isActivePublicRoom || isCurrentTemplateTooLarge || !selectedTemplateId}
          title={selectedTemplateId ? `${selectedTemplateName || "현재 템플릿"}에 덮어쓰기` : "먼저 템플릿을 불러오거나 새로 저장하세요."}
        >
          <FileJson size={15} />
          현재 템플릿 덮어쓰기
        </button>
      </div>
      {selectedTemplateId && !isActivePublicRoom ? <div className="emptyTemplates">편집 중: {selectedTemplateName || "이름 없는 템플릿"}</div> : null}
      <div className={`usageBox${isCurrentTemplateTooLarge ? " warning" : ""}`}>
        <div className="usageText">
          <span>현재 회차</span>
          <strong>
            {formatBytes(currentTemplateBytes)} / {formatBytes(currentTemplateLimitBytes)}
          </strong>
        </div>
        <div className="usageTrack" aria-hidden="true">
          <span style={{ width: `${currentTemplateRatio}%` }} />
        </div>
      </div>
      {activeRoomCode && roomStorageUsage ? (
        <div className="usageBox">
          <div className="usageText">
            <span>템플릿 저장량</span>
            <strong>
              {roomStorageUsage.templatesCount} / {roomStorageUsage.maxTemplates}
            </strong>
          </div>
          <div className="usageText subtle">
            <span>템플릿 데이터</span>
            <strong>{formatBytes(roomStorageUsage.templatesBytes)}</strong>
          </div>
          {imageStorageUsage ? (
            <div className={`usageBox nestedUsage${isImageStorageTooLarge ? " warning" : ""}`}>
              <div className="usageText subtle">
                <span>이미지 저장량</span>
                <strong>
                  {imageStorageUsage.imageCount}장 · {formatBytes(imageStorageUsage.imageBytes)} / {formatBytes(imageStorageLimitBytes)}
                </strong>
              </div>
              <div className="usageTrack" aria-hidden="true">
                <span style={{ width: `${imageStorageRatio}%` }} />
              </div>
              {imageStorageUsage.temporaryImageCount ? (
                <div className="usageText subtle">
                  <span>임시 이미지</span>
                  <strong>
                    {imageStorageUsage.temporaryImageCount}장 · {formatBytes(imageStorageUsage.temporaryImageBytes ?? 0)}
                  </strong>
                </div>
              ) : null}
              {imageStorageUsage.missingImages ? (
                <div className="usageText subtle">
                  <span>누락 이미지</span>
                  <strong>{imageStorageUsage.missingImages}장</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {templatesMessage ? <div className="templateMessage">{templatesMessage}</div> : null}
      <div className="sectionHeaderRow">
        <div className="usageText">
          <span>최근 템플릿</span>
          <strong>{roomStorageUsage?.templatesCount ?? templates.length}개</strong>
        </div>
        {hiddenTemplateCount > 0 ? (
          <button type="button" className="inlineToggleButton" onClick={toggleTemplateListExpanded} disabled={templatesLoading || isActivePublicRoom}>
            {isTemplateListExpanded ? "접기" : `... ${hiddenTemplateCount}개 더 보기`}
          </button>
        ) : null}
      </div>
      {activeRoomCode && templates.length === 0 && !templatesLoading ? (
        <div className="emptyTemplates">저장된 템플릿 없음</div>
      ) : (
        <div className="templateList">
          {templates.map((template) => (
            <div className="templateItem" key={template.id}>
              <button type="button" className="templateLoad" onClick={() => loadTemplate(template)} title="템플릿 불러오기">
                <span>{template.name}</span>
                <small>
                  {new Date(template.createdAt).toLocaleString()}
                  {template.versionCount ? ` · 버전 ${template.versionCount}` : ""}
                  {template.bytes ? ` · ${formatBytes(template.bytes)}` : ""}
                </small>
              </button>
              <button type="button" className="iconButton" onClick={() => restoreLatestTemplateVersion(template.id)} aria-label="이전 버전으로 되돌리기" disabled={templatesLoading || isActivePublicRoom || !template.versionCount}>
                <RotateCcw size={15} />
              </button>
              <button type="button" className="iconButton danger" onClick={() => deleteTemplate(template.id)} aria-label="템플릿 삭제" disabled={templatesLoading || isActivePublicRoom}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {(roomStorageUsage?.trashedTemplatesCount ?? trashedTemplates.length) ? (
        <div className="trashBox">
          <div className="sectionHeaderRow">
            <div className="usageText">
              <span>휴지통</span>
              <strong>{roomStorageUsage?.trashedTemplatesCount ?? trashedTemplates.length}개</strong>
            </div>
            <button type="button" className="inlineToggleButton" onClick={toggleTrashExpanded} disabled={templatesLoading || isActivePublicRoom}>
              {isTrashExpanded ? "접기" : hiddenTrashCount > 0 ? `펼치기 (${hiddenTrashCount}개 숨김)` : "펼치기"}
            </button>
          </div>
          {isTrashExpanded ? (
            trashedTemplates.length ? (
              <div className="templateList">
                {trashedTemplates.map((template) => (
                  <div className="templateItem" key={`trash-${template.id}`}>
                    <button type="button" className="templateLoad" onClick={() => restoreTemplate(template.id)} disabled={templatesLoading || isActivePublicRoom} title="템플릿 복구">
                      <span>{template.name}</span>
                      <small>삭제 {template.deletedAt ? new Date(template.deletedAt).toLocaleString() : ""}</small>
                    </button>
                    <button type="button" className="iconButton" onClick={() => restoreTemplate(template.id)} aria-label="템플릿 복구" disabled={templatesLoading || isActivePublicRoom}>
                      <Undo2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyTemplates">휴지통이 비어 있습니다.</div>
            )
          ) : null}
        </div>
      ) : null}
      {activityLog.length ? (
        <div className="activityBox">
          <div className="usageText">
            <span>최근 활동</span>
            <strong>{activityLog.length}</strong>
          </div>
          <div className={`activityList${activityLog.length > 5 ? " scrollable" : ""}`}>
            {activityLog.map((entry) => (
              <div className="activityItem" key={entry.id}>
                <span>{formatActivityType(entry.type)}</span>
                <strong>{entry.targetName}</strong>
                <small>{new Date(entry.at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
