package com.trackbit.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.IssueRepository
import com.trackbit.core.model.IssueRules
import com.trackbit.core.model.IssueType
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class IssueReportError { Offline, Failed }

data class IssueReportUiState(
    val type: IssueType = IssueType.Bug,
    val description: String = "",
    /** What the report says sent it (shown like the web's route line). */
    val client: String = "",
    val sending: Boolean = false,
    val sent: Boolean = false,
    val error: IssueReportError? = null,
) {
    val canSend get() = IssueRules.descriptionValid(description) && !sending && !sent
}

/** The web's "Report a Bug" dialog: a bug or feedback, described, sent with this build and device. */
@HiltViewModel
class IssueReportViewModel @Inject constructor(private val issues: IssueRepository) : ViewModel() {
    private val _state = MutableStateFlow(IssueReportUiState(client = issues.client))
    val state: StateFlow<IssueReportUiState> = _state.asStateFlow()

    fun selectType(type: IssueType) = _state.update { it.copy(type = type) }

    fun editDescription(description: String) =
        _state.update { it.copy(description = description.take(IssueRules.DESCRIPTION_MAX), error = null) }

    fun send() {
        val current = _state.value
        if (!current.canSend) return
        _state.update { it.copy(sending = true, error = null) }
        viewModelScope.launch {
            val result = issues.report(current.type, current.description)
            _state.update {
                when (result) {
                    is ConfigResult.Success -> it.copy(sending = false, sent = true)
                    is ConfigResult.Failure -> it.copy(
                        sending = false,
                        error = if (result.error == ConfigError.Offline) IssueReportError.Offline else IssueReportError.Failed,
                    )
                }
            }
        }
    }
}
