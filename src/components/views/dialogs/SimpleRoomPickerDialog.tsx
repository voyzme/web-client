/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { ChangeEvent, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import {
    RovingTabIndexContext,
    RovingTabIndexProvider,
    Type,
    findSiblingElement,
} from "../../../accessibility/RovingTabIndex";
import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import classNames from "classnames";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import Spinner from "../elements/Spinner";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

// Constants
const AVATAR_SIZE = "32px";

// Interface definitions
interface IProps {
    initialText?: string;
    onFinished(): void;
    onRoomSelected?(room: Room): void;
    rooms: Room[];
    currentRoomId?: string;
}

interface IResult {
    room: Room;
    avatar: JSX.Element;
    name: string;
}

// Option component for rendering a selectable item
const Option: React.FC<{
    id: string;
    className?: string;
    onClick: (ev: React.MouseEvent | React.KeyboardEvent) => void;
    children: React.ReactNode;
}> = ({ id, className, onClick, children }) => {
    const rovingContext = useContext(RovingTabIndexContext);

    return (
        <AccessibleButton
            id={id}
            role="option"
            tabIndex={-1}
            className={classNames("mx_SpotlightDialog_option", className)}
            onClick={onClick}
            onFocus={(ev) => {
                rovingContext.dispatch({
                    type: Type.SetFocus,
                    payload: { target: ev.currentTarget },
                });
            }}
        >
            {children}
        </AccessibleButton>
    );
};

// Main component
const SimpleRoomPickerDialog: React.FC<IProps> = ({
    initialText = "",
    onFinished,
    onRoomSelected,
    rooms,
    currentRoomId,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, setQuery] = useState(initialText);
    const [loading, setLoading] = useState(false);
    const [filteredRooms, setFilteredRooms] = useState<Room[]>(rooms);

    // Filter rooms based on query - left empty for now
    useEffect(() => {
        // Placeholder for future search logic
        // We're just setting all rooms as filtered for now
        setFilteredRooms(rooms);
    }, [query, rooms]);

    // Reset focus when results change
    useEffect(() => {
        setTimeout(() => {
            const node = rovingContext.state.nodes[0];
            if (node) {
                rovingContext.dispatch({
                    type: Type.SetFocus,
                    payload: { node },
                });
                node?.scrollIntoView?.({
                    block: "nearest",
                });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredRooms]);

    const handleQueryChange = (e: ChangeEvent<HTMLInputElement>): void => {
        setQuery(e.target.value);
    };

    const selectRoom = useCallback(
        (room: Room, viaKeyboard = false) => {
            if (onRoomSelected) {
                onRoomSelected(room);
            }
            onFinished();
        },
        [onRoomSelected, onFinished],
    );

    // Keyboard navigation handlers
    const onDialogKeyDown = (ev: KeyboardEvent | React.KeyboardEvent): void => {
        const navigationAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navigationAction) {
            case KeyBindingAction.FilterRooms:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }

        let node: HTMLElement | undefined;
        const accessibilityAction = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (accessibilityAction) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
            case KeyBindingAction.ArrowUp:
            case KeyBindingAction.ArrowDown:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.activeNode && rovingContext.state.nodes.length > 0) {
                    const nodes = rovingContext.state.nodes;
                    const idx = nodes.indexOf(rovingContext.state.activeNode);
                    node = findSiblingElement(nodes, idx + (accessibilityAction === KeyBindingAction.ArrowUp ? -1 : 1));
                }
                break;
        }

        if (node) {
            rovingContext.dispatch({
                type: Type.SetFocus,
                payload: { node },
            });
            node?.scrollIntoView({
                block: "nearest",
            });
        }
    };

    const [searchResults, setSearchResults] = useState<string>("");

    const executeSearch = useCallback(async () => {
        if (!query.trim() || !currentRoomId) return;

        setLoading(true);
        try {
            // Prepare the request payload
            const payload = {
                search_query: query,
                language: navigator.language || "en",
            };

            // Use MatrixClientPeg to get the client and make an authenticated request
            const cli = MatrixClientPeg.safeGet();
            if (!cli) {
                throw new Error("Matrix client not initialized");
            }

            try {
                // Use the authedRequest method similar to SummaryView.tsx
                const data = await cli.http.authedRequest(
                    "POST",
                    `/_synapse/client/v1/rooms/${encodeURIComponent(currentRoomId)}/search`,
                    undefined, // query params
                    payload, // request body
                    {
                        prefix: "",
                        useAuthorizationHeader: true,
                    },
                );
                // Process the response directly
                // With these lines:
                if (data && data["search-result"] && data["search-result"].answer) {
                    setSearchResults(data["search-result"].answer);
                } else {
                    setSearchResults("No answer found in the search results.");
                }
                return; // Early return since we've processed the data
            } catch (error) {
                // If the authedRequest method fails, log the error and continue with fallback
                logger.error("Error using authedRequest:", error);
                throw error; // Re-throw to be caught by the outer try-catch
            }

            // This code won't be reached if the authedRequest is successful
            // It's kept as a fallback in case we need to revert to the direct fetch approach
        } catch (error) {
            logger.error("Error executing search:", error);
            setSearchResults(`Error: ${String(error)}`);
        } finally {
            setLoading(false);
        }
    }, [query, currentRoomId]);

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Enter:
                ev.stopPropagation();
                ev.preventDefault();
                executeSearch();
                break;
        }
    };

    // Generate room results
    const roomResults = filteredRooms.map((room) => ({
        room,
        avatar: <DecoratedRoomAvatar room={room} size={AVATAR_SIZE} tooltipProps={{ tabIndex: -1 }} />,
        name: room.name,
    }));

    const activeDescendant = rovingContext.state.activeNode?.id;

    return (
        <>
            <div id="mx_SimpleRoomPickerDialog_keyboardPrompt">Ask me something about the previous conversations</div>

            <BaseDialog
                className="mx_SpotlightDialog"
                onFinished={onFinished}
                hasCancel={false}
                onKeyDown={onDialogKeyDown}
                screenName="SimpleRoomPicker"
                aria-label={_t("Room Picker")}
            >
                <div className="mx_SpotlightDialog_searchBox mx_textinput">
                    <input
                        ref={inputRef}
                        autoFocus
                        type="text"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder={_t("action|search")}
                        value={query}
                        onChange={handleQueryChange}
                        onKeyDown={onKeyDown}
                        aria-owns="mx_SimpleRoomPickerDialog_content"
                        aria-activedescendant={activeDescendant}
                        aria-label={_t("action|search")}
                        aria-describedby="mx_SimpleRoomPickerDialog_keyboardPrompt"
                    />
                    {loading && <Spinner w={24} h={24} />}
                </div>

                <div className="mx_SpotlightDialog_description">
                    {searchResults && (
                        <div className="mx_SpotlightDialog_searchResults">
                            <h4>Search Results:</h4>
                            <pre
                                style={{
                                    maxHeight: "200px",
                                    overflow: "auto",
                                    whiteSpace: "pre-wrap",
                                    fontSize: "12px",
                                }}
                            >
                                {searchResults}
                            </pre>
                        </div>
                    )}
                </div>
            </BaseDialog>
        </>
    );
};

// Wrap with RovingTabIndexProvider for accessibility
const RovingSimpleRoomPickerDialog: React.FC<IProps> = (props) => {
    return <RovingTabIndexProvider>{() => <SimpleRoomPickerDialog {...props} />}</RovingTabIndexProvider>;
};

export default RovingSimpleRoomPickerDialog;
